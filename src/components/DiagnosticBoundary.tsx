'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { diagBeacon, diagMark } from '@/lib/diag';

/**
 * TEMPORARY DIAGNOSTIC - remove once the Nimiq Pay post-auth failure is
 * understood.
 *
 * Without a boundary, an exception thrown while rendering the authenticated
 * tree unmounts everything and leaves a blank page with no trace. This
 * captures it, marks it durably, and shows what threw instead of failing
 * silently.
 *
 * It changes no application logic: on the success path it renders its
 * children untouched.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class DiagnosticBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    diagMark('render_error');
    // Only the error's constructor name leaves the device. The message can
    // quote application values, so it is shown on screen but never sent.
    diagBeacon(`render_error_${error.name}`.slice(0, 40));
    try {
      console.error('AUTH_STEP=render_error_detail', error, info.componentStack);
    } catch {
      // ignored
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="card">
        <div className="card-head">
          <h2>Diagnostic: render failed</h2>
          <span className="badge bad">Caught</span>
        </div>
        <p className="muted">
          Preventah hit an error while drawing this screen. Your stake and
          funds are unaffected. The details below identify the fault.
        </p>
        <div className="notice error" style={{ marginTop: 12 }}>
          <strong>{error.name}</strong>
          <br />
          {error.message}
        </div>
        <p className="faint">
          Temporary diagnostic build. Please report this text.
        </p>
      </section>
    );
  }
}
