'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/*
 * The report route's one client module (19-UI-SPEC §4.2): `Print or save as PDF` opens the browser's print dialog,
 * where the person prints the A4 report or saves it as a PDF. Printing happens in the browser and is not observed (D-23).
 */
export function ReportToolbar() {
  return (
    <Button onClick={() => window.print()} type="button">
      <Printer aria-hidden="true" className="size-4" />
      Print or save as PDF
    </Button>
  );
}
