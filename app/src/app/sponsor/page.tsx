import { ComingSoon } from "@/components/coming-soon";
import { SponsorArt } from "@/components/art";

export const metadata = { title: "Sponsor — drop a pot, set a challenge · Stakehold" };

export default function SponsorPage() {
  return (
    <ComingSoon
      page="sponsor"
      eyebrow="Stakehold Sponsor"
      title={
        <>
          Drop a pot. <span className="text-gradient">Set a challenge.</span>
        </>
      }
      lede={
        <>
          For brands, creators, employers, communities — or generous individuals. Fund a prize pot and challenge many people at once:{" "}
          <i className="text-ink">&ldquo;Run 5 km a day for 30 days — $500 for everyone who finishes.&rdquo;</i> Funds sit in escrow and pay out automatically to everyone who meets
          the criteria.
        </>
      }
      art={<SponsorArt className="mx-auto w-full max-w-md" />}
      features={[
        { icon: "🎯", title: "You set the criteria", body: "Choose the habit, duration and the proof required. Optional AI help designs fair, hard-to-cheat rules and rates their strength." },
        { icon: "⚖️", title: "AI or manual judging", body: "Let the AI referee judge every proof, or review proofs yourself with AI suggestions alongside each one." },
        { icon: "🔐", title: "Escrowed & automatic", body: "Your pot is locked in a program vault. Everyone who completes the challenge is paid automatically — no spreadsheets." },
        { icon: "🏢", title: "Built for programs", body: "Corporate wellness, fitness and learning brands, creator community challenges, scholarships for learners." },
      ]}
      flow={[
        { title: "Describe the challenge", body: "Plain English in, a proof plan with a strength rating out." },
        { title: "Fund the pot", body: "Deposit the prize into escrow. Stakehold charges a service fee for hosting and judging." },
        { title: "People join & prove", body: "Participants submit daily proof; judging is AI or manual — your call." },
        { title: "Finishers get paid", body: "At the end the pot is split among everyone who met the criteria, onchain." },
      ]}
      extra={
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 text-sm text-muted">
          <b className="text-ink">Pricing preview:</b> a flat service fee on the sponsored pot covers hosting, AI judging and payouts. Manual-judging sponsors get a dashboard with
          AI suggestions for every proof.
        </div>
      }
    />
  );
}
