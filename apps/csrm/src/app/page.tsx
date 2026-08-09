import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-md py-xl text-foreground sm:px-lg lg:px-xl">
      <div className="mx-auto max-w-canvas">
        <Card className="max-w-2xl">
          <CardContent className="space-y-md p-lg">
            <h1 className="text-display font-semibold">Cyber Risk Manager</h1>
            <p className="text-body">Your cyber risk management workspace is ready.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
