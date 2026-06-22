import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

interface ContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: string) => void;
}

function DesignSystemDialog({ open, onOpenChange, onSave }: ContextDialogProps) {
  const [value, setValue] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Design System</DialogTitle>
          <DialogDescription>
            Paste your design system context, tokens, or reference a DESIGN.md file path.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Paste your design system colors, typography, spacing tokens, or component rules..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[200px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(value);
              onOpenChange(false);
            }}
          >
            Add context
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScreenshotDialog({ open, onOpenChange, onSave }: ContextDialogProps) {
  const [value, setValue] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Screenshot</DialogTitle>
          <DialogDescription>
            Describe the screenshot or paste image notes. Image attachment will be available in a
            future update.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Describe what the screenshot shows, or paste a data URL..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[150px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(value);
              onOpenChange(false);
            }}
          >
            Add notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FigmaDialog({ open, onOpenChange, onSave }: ContextDialogProps) {
  const [value, setValue] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Figma</DialogTitle>
          <DialogDescription>
            Paste a Figma file URL or exported design tokens. Full Figma integration requires setup.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Paste Figma URL, export JSON, or design notes..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[150px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(value);
              onOpenChange(false);
            }}
          >
            Add context
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const CONTEXT_DIALOGS: Record<string, (props: ContextDialogProps) => ReactNode> = {
  "design-system": DesignSystemDialog,
  screenshot: ScreenshotDialog,
  figma: FigmaDialog,
};

export function renderContextDialog(kind: string, props: ContextDialogProps): ReactNode {
  const DialogComponent = CONTEXT_DIALOGS[kind];
  if (!DialogComponent) return null;
  return <DialogComponent {...props} />;
}
