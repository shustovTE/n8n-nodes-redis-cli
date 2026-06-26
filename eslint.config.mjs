import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

/**
 * This is a self-hosted utility node rather than an n8n Cloud marketplace node,
 * so two marketplace-only policy rules are intentionally disabled below:
 *
 *  - `no-runtime-dependencies` / runtime imports: a Redis node cannot work
 *    without the `redis` client library, so it ships as a real dependency.
 *  - `no-credential-reuse`: the node deliberately reuses n8n's built-in,
 *    first-party `redis` credential so users don't have to re-enter their
 *    connection details (see README → "n8n Cloud compatibility").
 *
 * Every other community-node lint rule stays active.
 */
export default [
	...configWithoutCloudSupport,
	{
		rules: {
			'@n8n/community-nodes/no-runtime-dependencies': 'off',
			'@n8n/community-nodes/no-credential-reuse': 'off',
		},
	},
];
