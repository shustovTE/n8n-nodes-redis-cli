import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { createClient } from 'redis';

/**
 * `string-argv` is published as an ES module, so it has to be imported
 * dynamically from this CommonJS node. Resolve it once and cache the promise so
 * the import cost is not paid again on every execution.
 */
type ArgvParser = (value: string) => string[];
let argvParserPromise: Promise<ArgvParser> | undefined;

function getArgvParser(): Promise<ArgvParser> {
	if (!argvParserPromise) {
		argvParserPromise = import('string-argv').then(
			(mod) => (mod.parseArgsStringToArgv ?? mod.default) as ArgvParser,
		);
	}
	return argvParserPromise;
}

/** Extract a readable message from any thrown value, without assuming it is an Error. */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export class RedisCli implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Redis CLI',
		name: 'redisCli',
		icon: { light: 'file:redis.svg', dark: 'file:redis.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["command"] }}',
		description: 'Execute arbitrary Redis CLI commands',
		usableAsTool: true,
		defaults: {
			name: 'Redis CLI',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		// Reuse n8n's built-in Redis credentials.
		credentials: [
			{
				name: 'redis',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Command',
				name: 'command',
				type: 'string',
				default: '',
				placeholder: 'e.g., SET mykey "hello world"',
				required: true,
				description: 'The raw Redis CLI command to execute',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Connection Timeout',
						name: 'connectTimeout',
						type: 'number',
						default: 10000,
						typeOptions: { minValue: 0 },
						description:
							'How long to wait (in milliseconds) while establishing the connection before failing. Prevents the workflow from hanging on an unreachable server.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('redis');
		const options = this.getNodeParameter('options', 0, {}) as {
			connectTimeout?: number;
		};
		const connectTimeout = options.connectTimeout ?? 10000;

		const useTls = credentials.ssl === true;
		const client = createClient({
			socket: {
				host: credentials.host as string,
				port: credentials.port as number,
				connectTimeout,
				// Fail fast with the real error instead of silently retrying (which
				// would multiply the wait and mask the cause). Drops between commands
				// are recovered explicitly in the loop below.
				reconnectStrategy: false,
				...(useTls ? { tls: true as const } : {}),
			},
			database: credentials.database as number,
			username: (credentials.user as string) || undefined,
			password: (credentials.password as string) || undefined,
			// Fail commands immediately when the connection is down instead of
			// silently queueing them.
			disableOfflineQueue: true,
		});

		// A Redis client is an EventEmitter; an unhandled 'error' event would crash
		// the whole n8n process. Absorb the event and keep the latest error so it can
		// be reported with a meaningful message (the awaited calls sometimes only
		// reject with a generic "client is closed").
		let lastClientError: unknown;
		client.on('error', (error) => {
			lastClientError = error;
		});

		const parseArgv = await getArgvParser();

		try {
			try {
				await client.connect();
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Could not connect to Redis: ${getErrorMessage(lastClientError ?? error)}`,
				);
			}

			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
				let commandString = '';
				try {
					// Re-establish the connection if it dropped between items.
					if (!client.isOpen) {
						await client.connect();
					}

					commandString = this.getNodeParameter('command', itemIndex) as string;
					// Parse the command into arguments, honouring quoted segments.
					const args = parseArgv(commandString);

					if (args.length === 0) {
						throw new NodeOperationError(this.getNode(), 'Command cannot be empty', {
							itemIndex,
						});
					}

					const result = await client.sendCommand(args);

					returnData.push({
						json: { command: commandString, result } as IDataObject,
						pairedItem: { item: itemIndex },
					});
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: { command: commandString, error: getErrorMessage(error) },
							pairedItem: { item: itemIndex },
						});
						continue;
					}
					throw error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), getErrorMessage(error), { itemIndex });
				}
			}
		} finally {
			// Always release the connection, even on error, but only when something
			// is actually open: calling destroy() on an already-closed client throws.
			// quit() drains pending replies gracefully; destroy() forces a broken
			// socket down. Cleanup must never throw and mask the original error.
			if (client.isOpen) {
				try {
					await client.quit();
				} catch {
					try {
						client.destroy();
					} catch {
						// Socket already gone — nothing left to clean up.
					}
				}
			}
		}

		return [returnData];
	}
}
