/**
 * Exact OAuth implementation from @google/gemini-cli-core
 * Copied directly from gemini-cli/packages/core/src/code_assist/oauth2.ts
 * Only removing telemetry dependencies that cause OpenTelemetry import issues
 */

import * as http from "http"
import * as net from "net"
import * as url from "url"
import * as crypto from "crypto"
import * as os from "os"
const open = require("open")
import * as path from "node:path"
import { promises as fs } from "fs"
import { OAuth2Client, Credentials, Compute, CodeChallengeMethod } from "google-auth-library"
import { AuthType, MinimalConfig } from "./gemini-code-assist-config.js"
import { getErrorMessage } from "./gemini-code-assist-utils.js"

//  OAuth Client ID used to initiate OAuth2Client class.
const OAUTH_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"

// OAuth Secret value used to initiate OAuth2Client class.
// Note: It's ok to save this in git because this is an installed application
// as described here: https://developers.google.com/identity/protocols/oauth2#installed
// "The process results in a client ID and, in some cases, a client secret,
// which you embed in the source code of your application. (In this context,
// the client secret is obviously not treated as a secret.)"
const OAUTH_CLIENT_SECRET = "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"

// OAuth Scopes for Cloud Code authorization.
const OAUTH_SCOPE = [
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
]

const HTTP_REDIRECT = 301
const SIGN_IN_SUCCESS_URL = "https://developers.google.com/gemini-code-assist/auth_success_gemini"
const SIGN_IN_FAILURE_URL = "https://developers.google.com/gemini-code-assist/auth_failure_gemini"

const GEMINI_DIR = ".gemini"
const CREDENTIAL_FILENAME = "oauth_creds.json"

/**
 * An Authentication URL for updating the credentials of a Oauth2Client
 * as well as a promise that will resolve when the credentials have
 * been refreshed (or which throws error when refreshing credentials failed).
 */
export interface OauthWebLogin {
	authUrl: string
	loginCompletePromise: Promise<void>
}

export async function getOauthClient(authType: AuthType, config: MinimalConfig): Promise<OAuth2Client> {
	console.log("🔍 DEBUG: getOauthClient called with authType:", authType)
	console.log("🔍 DEBUG: Creating OAuth2Client...")

	const client = new OAuth2Client({
		clientId: OAUTH_CLIENT_ID,
		clientSecret: OAUTH_CLIENT_SECRET,
		transporterOptions: {
			proxy: config.getProxy(),
		},
	})

	console.log("🔍 DEBUG: OAuth2Client created successfully")

	client.on("tokens", async (tokens: Credentials) => {
		await cacheCredentials(tokens)
	})

	console.log("🔍 DEBUG: Checking for cached credentials...")
	// If there are cached creds on disk, they always take precedence
	if (await loadCachedCredentials(client)) {
		console.log("🔍 DEBUG: Found cached credentials, checking Google account...")
		// Found valid cached credentials.
		// Check if we need to retrieve Google Account ID or Email
		if (!getCachedGoogleAccount()) {
			console.log("🔍 DEBUG: No cached Google account, fetching user info...")
			try {
				await fetchAndCacheUserInfo(client)
			} catch {
				// Non-fatal, continue with existing auth.
			}
		}
		console.log("✅ Loaded cached credentials.")
		return client
	}

	console.log("🔍 DEBUG: No cached credentials found, starting OAuth flow...")

	// In Google Cloud Shell, we can use Application Default Credentials (ADC)
	// provided via its metadata server to authenticate non-interactively using
	// the identity of the user logged into Cloud Shell.
	if (authType === AuthType.CLOUD_SHELL) {
		try {
			console.log("Attempting to authenticate via Cloud Shell VM's ADC.")
			const computeClient = new Compute({
				// We can leave this empty, since the metadata server will provide
				// the service account email.
			})
			await computeClient.getAccessToken()
			console.log("Authentication successful.")

			// Do not cache creds in this case; note that Compute client will handle its own refresh
			return computeClient
		} catch (e) {
			throw new Error(`Unable to authenticate via Cloud Shell ADC: ${getErrorMessage(e)}`)
		}
	}

	// Exact CLI OAuth flow logic
	if (authType === AuthType.LOGIN_WITH_GOOGLE) {
		const webLogin = await authWithWeb(client)

		console.log(
			`\n\nCode Assist login required.\n` +
				`Attempting to open authentication page in your browser.\n` +
				`Otherwise navigate to:\n\n${webLogin.authUrl}\n\n`,
		)
		try {
			// Attempt to open the authentication URL in the default browser.
			// We do not use the `wait` option here because the main script's execution
			// is already paused by `loginCompletePromise`, which awaits the server callback.
			const childProcess = await open(webLogin.authUrl)

			// IMPORTANT: Attach an error handler to the returned child process.
			// Without this, if `open` fails to spawn a process (e.g., `xdg-open` is not found
			// in a minimal Docker container), it will emit an unhandled 'error' event,
			// causing the entire Node.js process to crash.
			childProcess.on("error", (_: any) => {
				console.error(
					"Failed to open browser automatically. Please try running again with NO_BROWSER=true set.",
				)
			})
		} catch (err) {
			console.error(
				"An unexpected error occurred while trying to open the browser:",
				err,
				"\nPlease try running again with NO_BROWSER=true set.",
			)
		}
		console.log("Waiting for authentication...")

		await webLogin.loginCompletePromise
	}

	return client
}

async function authWithWeb(client: OAuth2Client): Promise<OauthWebLogin> {
	const port = await getAvailablePort()
	// The hostname used for the HTTP server binding (e.g., '0.0.0.0' in Docker).
	const host = process.env.OAUTH_CALLBACK_HOST || "localhost"
	// The `redirectUri` sent to Google's authorization server MUST use a loopback IP literal
	// (i.e., 'localhost' or '127.0.0.1'). This is a strict security policy for credentials of
	// type 'Desktop app' or 'Web application' (when using loopback flow) to mitigate
	// authorization code interception attacks.
	const redirectUri = `http://localhost:${port}/oauth2callback`
	const state = crypto.randomBytes(32).toString("hex")
	const authUrl = client.generateAuthUrl({
		redirect_uri: redirectUri,
		access_type: "offline",
		scope: OAUTH_SCOPE,
		state,
	})

	const loginCompletePromise = new Promise<void>((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			try {
				if (req.url!.indexOf("/oauth2callback") === -1) {
					res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL })
					res.end()
					reject(new Error("Unexpected request: " + req.url))
				}
				// acquire the code from the querystring, and close the web server.
				const qs = new url.URL(req.url!, "http://localhost:3000").searchParams
				if (qs.get("error")) {
					res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL })
					res.end()

					reject(new Error(`Error during authentication: ${qs.get("error")}`))
				} else if (qs.get("state") !== state) {
					res.end("State mismatch. Possible CSRF attack")

					reject(new Error("State mismatch. Possible CSRF attack"))
				} else if (qs.get("code")) {
					const { tokens } = await client.getToken({
						code: qs.get("code")!,
						redirect_uri: redirectUri,
					})
					client.setCredentials(tokens)
					// Explicitly cache the tokens since setCredentials doesn't trigger 'tokens' event
					await cacheCredentials(tokens)
					// Retrieve and cache Google Account ID during authentication
					try {
						await fetchAndCacheUserInfo(client)
					} catch (error) {
						console.error("Failed to retrieve Google Account ID during authentication:", error)
						// Don't fail the auth flow if Google Account ID retrieval fails
					}

					res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_SUCCESS_URL })
					res.end()
					resolve()
				} else {
					reject(new Error("No code found in request"))
				}
			} catch (e) {
				reject(e)
			} finally {
				server.close()
			}
		})
		server.listen(port, host)
	})

	return {
		authUrl,
		loginCompletePromise,
	}
}

export function getAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		let port = 0
		try {
			const portStr = process.env.OAUTH_CALLBACK_PORT
			if (portStr) {
				port = parseInt(portStr, 10)
				if (isNaN(port) || port <= 0 || port > 65535) {
					return reject(new Error(`Invalid value for OAUTH_CALLBACK_PORT: "${portStr}"`))
				}
				return resolve(port)
			}
			const server = net.createServer()
			server.listen(0, () => {
				const address = server.address()! as net.AddressInfo
				port = address.port
			})
			server.on("listening", () => {
				server.close()
				server.unref()
			})
			server.on("error", (e) => reject(e))
			server.on("close", () => resolve(port))
		} catch (e) {
			reject(e)
		}
	})
}

async function loadCachedCredentials(client: OAuth2Client): Promise<boolean> {
	try {
		const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || getCachedCredentialPath()

		const creds = await fs.readFile(keyFile, "utf-8")
		client.setCredentials(JSON.parse(creds))

		// This will verify locally that the credentials look good.
		const { token } = await client.getAccessToken()
		if (!token) {
			return false
		}

		// This will check with the server to see if it hasn't been revoked.
		await client.getTokenInfo(token)

		return true
	} catch (_) {
		return false
	}
}

async function cacheCredentials(credentials: Credentials) {
	const filePath = getCachedCredentialPath()
	await fs.mkdir(path.dirname(filePath), { recursive: true })

	const credString = JSON.stringify(credentials, null, 2)
	await fs.writeFile(filePath, credString)
}

function getCachedCredentialPath(): string {
	return path.join(os.homedir(), GEMINI_DIR, CREDENTIAL_FILENAME)
}

export async function clearCachedCredentialFile() {
	try {
		await fs.rm(getCachedCredentialPath(), { force: true })
		// Clear the Google Account ID cache when credentials are cleared
		await clearCachedGoogleAccount()
	} catch (_) {
		/* empty */
	}
}

async function fetchAndCacheUserInfo(client: OAuth2Client): Promise<void> {
	try {
		const { token } = await client.getAccessToken()
		if (!token) {
			return
		}

		const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})

		if (!response.ok) {
			console.error("Failed to fetch user info:", response.status, response.statusText)
			return
		}

		const userInfo = await response.json()
		if (userInfo.email) {
			await cacheGoogleAccount(userInfo.email)
		}
	} catch (error) {
		console.error("Error retrieving user info:", error)
	}
}

// Exact user account caching functions from CLI
const GOOGLE_ACCOUNTS_FILENAME = "google_accounts.json"

interface UserAccounts {
	active: string | null
	old: string[]
}

function getGoogleAccountsCachePath(): string {
	return path.join(os.homedir(), GEMINI_DIR, GOOGLE_ACCOUNTS_FILENAME)
}

async function readAccounts(filePath: string): Promise<UserAccounts> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		if (!content.trim()) {
			return { active: null, old: [] }
		}
		return JSON.parse(content) as UserAccounts
	} catch (error: any) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			// File doesn't exist, which is fine.
			return { active: null, old: [] }
		}
		// File is corrupted or not valid JSON, start with a fresh object.
		console.debug("Could not parse accounts file, starting fresh.", error)
		return { active: null, old: [] }
	}
}

async function cacheGoogleAccount(email: string): Promise<void> {
	const filePath = getGoogleAccountsCachePath()
	await fs.mkdir(path.dirname(filePath), { recursive: true })

	const accounts = await readAccounts(filePath)

	if (accounts.active && accounts.active !== email) {
		if (!accounts.old.includes(accounts.active)) {
			accounts.old.push(accounts.active)
		}
	}

	// If the new email was in the old list, remove it
	accounts.old = accounts.old.filter((oldEmail) => oldEmail !== email)

	accounts.active = email
	await fs.writeFile(filePath, JSON.stringify(accounts, null, 2), "utf-8")
}

function getCachedGoogleAccount(): string | null {
	try {
		const filePath = getGoogleAccountsCachePath()
		const fsSync = require("fs")
		if (fsSync.existsSync(filePath)) {
			const content = fsSync.readFileSync(filePath, "utf-8").trim()
			if (!content) {
				return null
			}
			const accounts: UserAccounts = JSON.parse(content)
			return accounts.active
		}
		return null
	} catch (error) {
		console.debug("Error reading cached Google Account:", error)
		return null
	}
}

async function clearCachedGoogleAccount(): Promise<void> {
	const filePath = getGoogleAccountsCachePath()
	const fsSync = require("fs")
	if (!fsSync.existsSync(filePath)) {
		return
	}

	const accounts = await readAccounts(filePath)

	if (accounts.active) {
		if (!accounts.old.includes(accounts.active)) {
			accounts.old.push(accounts.active)
		}
		accounts.active = null
	}

	await fs.writeFile(filePath, JSON.stringify(accounts, null, 2), "utf-8")
}
