import { Link, Outlet } from "react-router";
import { ROUTES } from "../game";

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between border-b-2 border-panel-edge py-4">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          <Link to={ROUTES.start}>
            🎒 Backpack <span className="text-gold">Brawl</span>
          </Link>
        </h1>
        {/** REQUIREMENT 7: Make the ranking reachable --> submitting worked, but could not see results */}
        <Link to={ROUTES.hallOfFame} className="text-gold">Hall of Fame</Link>
      </header>

      <main className="flex flex-1 flex-col gap-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-panel-edge py-3 text-xs tracking-wider text-muted">
        <p>Backpack Brawl · practical exam starter</p>
        {/* [req-6.9]: Explain automatic saving and refresh behavior by phase. */}
        <details className="mt-3 rounded-lg border border-panel-edge bg-panel px-3 py-2 text-sm tracking-normal">
          <summary className="cursor-pointer font-display font-bold text-gold marker:text-gold">
            Save &amp; Resume Policy
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="font-bold text-parchment">Automatic Saving</dt>
              <dd>
                Your progress is automatically saved as you play, provided browser storage is available. You
                can refresh or close the page and continue your run later in the same browser.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">During Shopping</dt>
              <dd>
                All purchases, sales, shop offers, backpack arrangements, gold, and round progress are
                preserved. Refreshing will not generate new offers or refund spent gold.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">During Matchmaking</dt>
              <dd>
                Refreshing cancels the current search and returns you to the shop without changing your
                progress. You can search again for the same opponent.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">During a Battle</dt>
              <dd>
                Your battle resumes from the last saved point with the same opponent and outcome. Refreshing
                cannot restart the fight or change its result.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">After a Battle</dt>
              <dd>
                Once a battle is completed, its result is final. Refreshing will not grant additional
                rewards, restore lost lives, or count the battle twice.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">After Completing a Run</dt>
              <dd>
                Your final result, entered player name, and Hall of Fame submission status are preserved.
                Failed submissions can be retried, while successfully submitted scores cannot be submitted
                again through the form.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">Starting a New Run</dt>
              <dd>
                Only one run can be saved at a time. Starting a new run replaces your previous save,
                provided browser storage is available.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-parchment">Invalid or Missing Saved Data</dt>
              <dd>
                If your saved progress is corrupted or incompatible, the game allows you to start a fresh
                run. Progress is stored locally and may be lost if you clear your browser data, disable
                browser storage, or switch to another browser or device.
              </dd>
            </div>
          </dl>
        </details>
      </footer>
    </div>
  );
}
