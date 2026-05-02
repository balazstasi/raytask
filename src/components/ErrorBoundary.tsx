import { Detail } from "@raycast/api";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches React rendering errors and shows a friendly fallback
 * instead of crashing the whole extension.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Detail
          markdown={`# Something went wrong

${this.state.error.message}`}
        />
      );
    }
    return this.props.children;
  }
}
