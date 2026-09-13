import App from "@/components/App";

/**
 * The Mini App is a single screen driven entirely by client state, so the
 * page itself is just a mount point. Everything it needs comes from
 * /api/me after the wallet handshake.
 */
export default function Page() {
  return <App />;
}
