import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function EmptyState() {
  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <h2 className="text-heading font-semibold">Nothing to show yet</h2>
      </CardHeader>
      <CardContent className="pt-0 text-body text-muted-foreground">
        There are no items available here yet. When work is available, it will appear in this list.
      </CardContent>
    </Card>
  );
}
