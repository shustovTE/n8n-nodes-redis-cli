# n8n-nodes-redis-cli

This is a custom node for n8n that allows you to execute raw Redis CLI commands directly within your workflows. 

Unlike standard Redis nodes that limit you to predefined operations (like GET, SET, or DELETE), this node provides a text input where you can type any valid Redis CLI command, and it will be executed against your database.

## Features

* Executes arbitrary Redis commands.
* Parses commands with quotes correctly (e.g., `SET mykey "hello world"`).
* Uses the built-in n8n Redis credentials, meaning you do not need to configure separate authentication for this node.
* Outputs the raw result directly from the Redis server.

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

## License

MIT
