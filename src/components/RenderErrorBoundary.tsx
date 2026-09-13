'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches a render failure in the authenticated screen and shows it.
 *
 * Without this, an exception thrown during render unmounts the whole tree.
 * In a normal browser that is a blank page; inside the Nimiq Pay WebView it
 * surfaces as the host's generic "This page couldn't load", which is
 * indistinguishable from a network or host fault. That ambiguity is what
 * made the RangeError this guards against so expensive to find.
 *
 * It changes nothing on the success path: children render untouched.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class RenderErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      console.error('[preventah] render failed', error, info.componentStack);
    } catch {
      // Logging must never compound the failure.
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="pv-window has-offset" role="alert">
        <div className="pv-bar pv-bar-blush">
          <span>Display error</span>
        </div>
        <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
        <p className="muted">
          Preventah could not draw this screen. Your commitment, your streak
          and your funds are unaffected &mdash; this is a display fault only.
          Reopening the app usually clears it.
        </p>
        <div className="pv-notice pv-notice-error" style={{ marginTop: 12 }}>
          {error.name}: {error.message}
        </div>
        <p className="faint">
          If it keeps happening, please report the message above.
        </p>
      </section>
    );
  }
}
