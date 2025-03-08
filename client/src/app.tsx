import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./hooks/use-auth";
import { WebSocketProvider } from "./hooks/use-websocket";
import { queryClient } from "./lib/queryClient";
import Router from "./router";
import { Toaster } from "./components/ui/toaster";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <Router />
          <Toaster />
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}