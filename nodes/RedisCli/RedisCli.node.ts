import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { createClient } from 'redis';

export class RedisCli implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Redis CLI',
		name: 'redisCli',
		// You can use the standard redis icon if available, or a generic one
		icon: 'file:redis.svg',
		group: ['transform'],
		version: 1,
		description: 'Execute arbitrary Redis CLI commands',
		defaults: {
			name: 'Redis CLI',
		},
		inputs: ['main'],
		outputs: ['main'],
		// We reuse the standard n8n Redis credentials here!
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// 1. Fetch the default Redis credentials from n8n
		const credentials = await this.getCredentials('redis');

		// 2. Configure the Redis client based on the credentials
		const socketConfig =
			credentials.ssl === true
				? {
						host: credentials.host as string,
						port: credentials.port as number,
						tls: true as const,
				  }
				: {
						host: credentials.host as string,
						port: credentials.port as number,
				  };

		const client = createClient({
			socket: socketConfig,
			database: credentials.database as number,
			username: (credentials.user as string) || undefined,
			password: (credentials.password as string) || undefined,
		});

		// 3. Connect to Redis
		await client.connect();

		// 4. Iterate over input items and execute commands
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const commandString = this.getNodeParameter('command', itemIndex) as string;

				// Parse the command string into an array of arguments.
				// This regex splits by spaces but preserves strings enclosed in double or single quotes.
				const argsRegex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
				const rawArgs = commandString.match(argsRegex) || [];
				
				// Strip the surrounding quotes from the parsed arguments
				const args = rawArgs.map(arg => arg.replace(/^['"]|['"]$/g, ''));

				if (args.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Command cannot be empty', { itemIndex });
				}

				// Execute the raw command using the redis library's sendCommand method
				const result = await client.sendCommand(args);

				returnData.push({
					json: {
						command: commandString,
						result: result,
					},
					pairedItem: {
						item: itemIndex,
					},
				});

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				await client.quit();
				throw new NodeOperationError(this.getNode(), error, { itemIndex });
			}
		}

		await client.quit();
		return [returnData];
	}
}
