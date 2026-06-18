# n8n-nodes-redis-cli

This is a custom node for n8n that allows you to execute raw Redis CLI commands directly within your workflows.

Unlike standard Redis nodes that limit you to predefined operations (like GET, SET, or DELETE), this node provides a text input where you can type any valid Redis CLI command, and it will be executed against your database.

## Features

* Executes arbitrary Redis commands.
* Parses commands with quotes correctly (e.g., `SET mykey "hello world"`).
* Uses the built-in n8n Redis credentials, meaning you do not need to configure separate authentication for this node.
* Supports TLS connections (via the **SSL** option of the Redis credential).
* Outputs the raw result directly from the Redis server.
* Reliable by design: a configurable connection timeout, automatic connection cleanup, and resilient error handling that won't crash n8n on a dropped connection.

## Installation

You can install this node directly from the n8n UI.

1. Go to **Settings** in your n8n instance.
2. Select **Community Nodes**.
3. Click **Install a community node**.
4. Enter `n8n-nodes-redis-cli` in the npm Package Name field.
5. Click **Install**.

Alternatively, if you are running n8n via Docker or a custom script, you can install it via npm in your n8n installation directory:

```bash
npm install n8n-nodes-redis-cli
```

## Usage

1. Add the **Redis CLI** node to your workflow canvas.
2. In the **Credential for Redis** dropdown, select your existing Redis credentials or create new ones.
3. In the **Command** parameter, type the raw Redis command you wish to execute.

### Options

| Option | Default | Description |
| --- | --- | --- |
| **Connection Timeout** | `10000` | How long to wait (in milliseconds) while establishing the connection before failing. Prevents the workflow from hanging on an unreachable server. |

## Command Examples

Here are a few examples of commands you can run:

* **String Operations:**
  * `SET user:1000 "John Doe"`
  * `GET user:1000`

* **Key Management:**
  * `KEYS *`
  * `EXPIRE user:1000 3600`
  * `DEL user:1000`

* **Hash Operations:**
  * `HSET user:profile name "Jane" age 30`
  * `HGETALL user:profile`

* **List Operations:**
  * `LPUSH mylist "first item"`
  * `LRANGE mylist 0 -1`

## Output Format

The node outputs a JSON object containing the exact command you ran and the result returned by the Redis server.

Example output for the command `GET mykey`:

```json
[
  {
    "command": "GET mykey",
    "result": "hello world"
  }
]
```

If a command fails and **Continue On Fail** is enabled for the node, the failing item is returned with the command and the error message instead of stopping the workflow:

```json
[
  {
    "command": "INCR mykey",
    "error": "ERR value is not an integer or out of range"
  }
]
```

## Security considerations

This node executes **arbitrary** Redis commands. Anyone who can edit a workflow that uses it can run *any* command against the configured database — including destructive ones such as `FLUSHALL`, `CONFIG SET`, or `SHUTDOWN`.

To use it safely:

* **Apply least privilege.** Connect with a dedicated Redis user whose [ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/) only allows the commands and keys the workflow actually needs.
* **Protect your credentials and workflows.** Limit who can edit workflows that include this node.
* **Prefer encrypted connections.** Enable the **SSL** option on the Redis credential when connecting over an untrusted network.

## n8n Cloud compatibility

This is a **self-hosted** community node. It depends on the `redis` client library at runtime and intentionally reuses n8n's built-in, first-party `redis` credential so you don't have to re-enter connection details. Both choices fall outside n8n Cloud's verified-marketplace policies, so the node targets self-hosted n8n instances.

## License

MIT
