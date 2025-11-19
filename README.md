# DBKeepAliveFunction

## Description

The `DBKeepAliveFunction` project is an Azure Function implementation designed to reduce cold starts by periodically sending "keep-alive" requests to an HTTP-triggered endpoint. This ensures that the function remains warm and responsive, improving performance for subsequent requests.

### Key Features:
1. **Single-Level Warmup**: The `keepAlive.js` function sends periodic pings to the HTTP endpoint. It includes:
   - **Cost-Saving Mode**: Sends a ping header and expects a `200 OK` response.
   - **Fallback Mode**: Sends a dummy email and expects a `400 Bad Request` response.
   - **Exponential Backoff**: Reduces ping frequency during consecutive failures to save resources.

2. **Two-Level Warmup (Example)**: The `keepAliveExt.js` file demonstrates a more advanced warmup strategy:
   - **Light Warmup**: Keeps only the HTTP-triggered API warm (every minute).
   - **Full Warmup**: Keeps both the API and the database warm (every `N` minutes, configurable via `WARMUP_INTERVAL_MINUTES`).

> **Note**: The current implementation only uses `keepAlive.js` for single-level warmup. The `keepAliveExt.js` file is provided as an example for implementing a two-level warmup strategy.

## File Overview

- **`src/index.js`**: Sets up the Azure Function app with HTTP streaming enabled.
- **`src/functions/keepAlive.js`**: Implements the single-level warmup logic with exponential backoff.
- **`src/functions/keepAliveExt.js`**: Provides an example of a two-level warmup strategy (not used in this project).

## Environment Variables

- `HTTP_TRIGGER_URL`: The URL of the HTTP-triggered function to keep warm.
- `PING_REQUEST_HEADER`: (Optional) The header name for cost-saving mode.
- `WARMUP_INTERVAL_MINUTES`: (Optional, for `keepAliveExt.js`) Interval for full warmup (default: 5 minutes).

## Usage

1. Deploy the function to Azure.
2. Configure the required environment variables.
3. Monitor the logs to ensure the function is running as expected.

## Future Enhancements

- Integrate the two-level warmup strategy from `keepAliveExt.js` to support both API and database warmup.
- Add more robust error handling and monitoring capabilities.