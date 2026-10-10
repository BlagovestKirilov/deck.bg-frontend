import React from 'react';
import StatusScreen from './ui/StatusScreen';

interface ErrorBoundaryState {
    failed: boolean;
}

/**
 * The last line under every screen: a render that throws shows a way back
 * instead of a blank page.
 *
 * Without it React unmounts the whole tree on one uncaught error, and the
 * player is left looking at the felt with nothing on it and no idea that a
 * reload is all it takes. The error is still logged, so it can be found.
 *
 * A class component because only a class can catch a render error.
 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    state: ErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo): void {
        console.error('Screen failed to render', error, info.componentStack);
    }

    render(): React.ReactNode {
        if (!this.state.failed) {
            return this.props.children;
        }
        return (
            <StatusScreen
                tone="error"
                icon="warning"
                title="Нещо се обърка"
                message="Страницата не успя да се зареди. Презаредете, за да опитате отново."
                actionLabel="Презареди"
                onAction={() => window.location.reload()}
                secondaryLabel="Към началната страница"
                onSecondary={() => window.location.assign('/')}
            />
        );
    }
}

export default ErrorBoundary;
