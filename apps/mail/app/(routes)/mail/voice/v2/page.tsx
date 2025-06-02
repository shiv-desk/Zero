import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { authClient, useSession } from '@/lib/auth-client';
import { useTRPC } from '@/providers/query-provider';
import { useConversation } from '@elevenlabs/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

const useElevenLabs = () => {
  const trpc = useTRPC();
  const {
    data: signedData,
    isLoading,
    status,
    error,
  } = useQuery(trpc.voice.getSignedUrl.queryOptions());

  if (error) {
    throw error;
  }

  if (status === 'pending') {
    return {
      isLoading,
    };
  }

  return {
    signedUrl: signedData.signedUrl,
    isLoading,
  };
};

// Loading component
const LoadingState = () => (
  <div className="container mx-auto p-6">
    <div className="mx-auto flex min-h-[400px] max-w-2xl items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  </div>
);

// Auth required component
const AuthRequired = () => (
  <div className="container mx-auto p-6">
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="mb-4 text-2xl font-bold">Authentication Required</h1>
      <p className="text-muted-foreground">Please log in to use the voice assistant.</p>
    </div>
  </div>
);

// Email loading status component
const EmailStatus = ({ isLoading, threadCount }: { isLoading: boolean; threadCount: number }) => {
  if (isLoading) {
    return (
      <div className="bg-muted rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading your recent emails...</p>
        </div>
      </div>
    );
  }

  if (threadCount > 0) {
    return (
      <div className="bg-muted rounded-lg p-3">
        <p className="text-muted-foreground text-sm">
          ✓ Loaded {threadCount} recent email{threadCount > 1 ? 's' : ''} for context
        </p>
      </div>
    );
  }

  return null;
};

// Conversation status component
const ConversationStatus = ({
  status,
  isInitializing,
  isSpeaking,
  errorMessage,
}: {
  status: string;
  isInitializing: boolean;
  isSpeaking: boolean;
  errorMessage: string;
}) => (
  <div className="bg-muted rounded-lg p-4 text-center">
    {status === 'disconnected' && !isInitializing && (
      <p className="text-muted-foreground">Ready to start</p>
    )}
    {isInitializing && (
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p className="text-muted-foreground">Initializing...</p>
      </div>
    )}
    {status === 'connected' && (
      <p className={`font-medium ${isSpeaking ? 'text-green-600' : 'text-blue-600'}`}>
        {isSpeaking ? 'Assistant is speaking...' : 'Listening...'}
      </p>
    )}
    {errorMessage && <p className="text-destructive mt-2 text-sm">{errorMessage}</p>}
  </div>
);

// Conversation controls component
const ConversationControls = ({
  isConnected,
  isInitializing,
  isLoadingThreads,
  isMuted,
  hasPermission,
  onStart,
  onEnd,
  onToggleMute,
  onRequestPermission,
}: {
  isConnected: boolean;
  isInitializing: boolean;
  isLoadingThreads: boolean;
  isMuted: boolean;
  hasPermission: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onRequestPermission: () => void;
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex justify-center gap-4">
      {isConnected ? (
        <>
          <Button variant="destructive" size="lg" onClick={onEnd} className="w-full max-w-xs">
            <MicOff className="mr-2 h-5 w-5" />
            End Conversation
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            className="h-12 w-12"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          disabled={isInitializing || isLoadingThreads}
          className="w-full max-w-xs"
        >
          {isInitializing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Mic className="mr-2 h-5 w-5" />
          )}
          Start Conversation
        </Button>
      )}
    </div>

    {!hasPermission && !isConnected && !isInitializing && (
      <Button variant="outline" onClick={onRequestPermission} className="mx-auto w-full max-w-xs">
        Enable Microphone Access
      </Button>
    )}
  </div>
);

// Main component
export default function VoicePage() {
  const { data: session, isPending } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const { signedUrl, cookie, isLoading } = useElevenLabs();

  useEffect(() => {
    if (!session) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setHasPermission(true);
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch(() => setHasPermission(false));
  }, [session]);

  const conversation = useConversation({
    onConnect: () => setIsInitializing(false),
    onDisconnect: () => setIsInitializing(false),
    onMessage: () => {},
    onError: (error: string | Error) => {
      setErrorMessage(typeof error === 'string' ? error : error.message);
      setIsInitializing(false);
    },
  });

  const { status, isSpeaking } = conversation;

  const requestMicPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const handleStartConversation = async () => {
    if (!hasPermission) {
      await requestMicPermission();
      if (!hasPermission) return;
    }

    try {
      setIsInitializing(true);
      setErrorMessage('');

      if (signedUrl) {
        const result = await authClient.token();
        const token = result.data?.token;

        if (!token) {
          throw new Error('No token found');
        }

        console.log('token', token);

        await conversation.startSession({
          signedUrl,
          dynamicVariables: {
            token: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Failed to start conversation', error);
      setErrorMessage('Failed to start conversation. Please try again.');
    }
  };

  const handleEndConversation = async () => {
    try {
      await conversation.endSession();
    } catch {
      setErrorMessage('Failed to end conversation');
    }
  };

  const toggleMute = async () => {
    try {
      await conversation.setVolume({ volume: isMuted ? 1 : 0 });
      setIsMuted(!isMuted);
    } catch {
      setErrorMessage('Failed to change volume');
    }
  };

  if (isPending) return <LoadingState />;
  if (!session) return <AuthRequired />;

  return (
    <div className="container mx-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold">Voice Assistant</h1>
        <Card>
          <CardHeader>
            <CardTitle>ElevenLabs Voice Interface</CardTitle>
            <CardDescription>
              Start a conversation with our AI voice assistant. Make sure your microphone is
              enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConversationStatus
              status={status}
              isInitializing={isInitializing}
              isSpeaking={isSpeaking}
              errorMessage={errorMessage}
            />

            <ConversationControls
              isConnected={status === 'connected'}
              isInitializing={isInitializing}
              isLoadingThreads={false}
              isMuted={isMuted}
              hasPermission={hasPermission}
              onStart={handleStartConversation}
              onEnd={handleEndConversation}
              onToggleMute={toggleMute}
              onRequestPermission={requestMicPermission}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
