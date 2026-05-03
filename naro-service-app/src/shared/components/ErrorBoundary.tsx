import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  children: ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
  fallback?: (reset: () => void, error: Error) => ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, { componentStack: info.componentStack ?? "" });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, error);

    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#0b0b0b",
          flex: 1,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: "#f5f5f5",
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Beklenmeyen bir hata oluştu
        </Text>
        <Text
          style={{
            color: "#a3a3a3",
            fontSize: 14,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          Sorun bize raporlandı. Yeniden denemek için aşağıdaki butona dokunun.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={{
            backgroundColor: "#3b82f6",
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Yeniden dene</Text>
        </Pressable>
      </View>
    );
  }
}
