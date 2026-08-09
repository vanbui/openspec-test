import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <>
      <PageHeader
        description="Your cyber risk management workspace is ready."
        title="Cyber Risk Manager"
      />
      <Card className="mt-2xl max-w-reading">
        <CardContent className="p-lg text-body text-muted-foreground">
          Use the CSRM workspace to prepare for the risk management work that follows.
        </CardContent>
      </Card>
    </>
  );
}
