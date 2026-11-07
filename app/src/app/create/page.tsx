import { CreateForm } from "@/components/create-form";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="mb-8">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">Create</div>
        <h1 className="font-display text-4xl font-extrabold">Start a challenge</h1>
        <p className="mt-2 max-w-xl text-muted">Set the habit, let the AI referee draft a fair proof plan, put SOL on the line and invite your crew.</p>
      </div>
      <CreateForm />
    </div>
  );
}
