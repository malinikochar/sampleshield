import { expect, test, type Page } from '@playwright/test';

async function signInAsDemoPersona(
  page: Page,
  personaKey: 'asha' | 'ravi' | 'priya' | 'kabir' | 'meera'
) {
  await page.goto('/login');
  await page.getByTestId(`demo-persona-${personaKey}`).click();
  await page.waitForURL('**/app/dashboard', { timeout: 25_000 });
  await expect(page.getByTestId('demo-dataset-banner')).toBeVisible();
}

async function signOutCleanly(page: Page) {
  await page.getByTestId('sign-out-button').click();
  await page.waitForURL('**/login', { timeout: 20_000 });
}

test.describe('SampleShield Chain-of-Custody PWA', () => {
  test('enforces unauthenticated route guard, renders safety boundary, and has zero horizontal overflow', async ({
    page,
  }) => {
    // 1. Unauthenticated access to /app/dashboard redirects to /login
    await page.goto('/app/dashboard');
    await page.waitForURL('**/login**');
    await expect(page.getByRole('heading', { name: /Sign in to SampleShield/i })).toBeVisible();

    // 2. Public landing page communicates operational chain-of-custody & non-diagnostic safety boundary
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Not a diagnostic medical device/i).first()).toBeVisible();

    const overflowLanding = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowLanding).toBeLessThanOrEqual(2);

    // 3. Sign in and verify responsive dashboard layout has zero horizontal overflow
    await signInAsDemoPersona(page, 'asha');
    const overflowDashboard = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowDashboard).toBeLessThanOrEqual(2);
  });

  test('executes full Collector -> Courier -> Wrong-Lab Block -> Authorized Lab Acceptance workflow', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'Full multi-role workflow runs once on desktop project against shared DB'
    );
    test.setTimeout(90_000);

    // 1. Clinic Collector creates & collects a new synthetic sample
    await signInAsDemoPersona(page, 'asha');
    await page.goto('/app/samples/new');

    await page.getByRole('button', { name: /Continue to Specimen Details/i }).click();
    await page.getByRole('button', { name: /Review Validation Summary/i }).click();
    await page.getByTestId('confirm-create-sample').click();

    await expect(page.getByText(/Sample Passport Persisted in Supabase/i)).toBeVisible({
      timeout: 15_000,
    });

    const codeLocator = page.locator('p.font-mono.text-2xl');
    const publicCode = (await codeLocator.innerText()).trim();
    expect(publicCode).toMatch(/^SS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-/);

    // Open Sample Passport and dispatch to Ravi Meena
    await page.getByTestId('open-created-passport').click();
    await page.waitForURL('**/app/samples/**');
    await page.getByTestId('btn-dispatch-sample').click();
    await expect(page.getByTestId('passport-action-feedback')).toContainText(/verified/i);

    await signOutCleanly(page);

    // 2. Courier scans/enters opaque code manually, records pickup, and is denied lab_accepted via RBAC
    await signInAsDemoPersona(page, 'ravi');
    await page.goto('/app/scan');
    await page.getByTestId('manual-qr-input').fill(publicCode);
    await page.getByTestId('manual-qr-submit').click();
    await page.waitForURL(`**/app/samples/${publicCode}`);

    await page.getByTestId('btn-courier-pickup').click();
    await expect(page.getByTestId('passport-action-feedback')).toContainText(/verified/i);

    // Verify server RBAC blocks courier from accepting specimen directly via API
    const rbacRes = await page.request.post('/api/events', {
      data: {
        client_event_id: crypto.randomUUID(),
        sample_public_code: publicCode,
        event_type: 'lab_accepted',
        metadata: { disposition_reason: 'Unauthorized courier attempt' },
      },
    });
    expect(rbacRes.status()).toBe(403);

    await signOutCleanly(page);

    // 3. Secondary Lab (Jaipur Hub) attempts receipt of Ajmer-designated sample -> BLOCKED with DESTINATION_MISMATCH
    await signInAsDemoPersona(page, 'kabir');
    await page.goto(`/app/samples/${publicCode}`);
    await expect(page.getByText(/Facility Mismatch Warning/i)).toBeVisible();
    await page.getByTestId('btn-lab-receive').click();
    await expect(page.getByTestId('passport-action-feedback')).toContainText(
      /Wrong destination laboratory/i
    );

    await signOutCleanly(page);

    // 4. Authorized Receiving Lab (Ajmer Reference Lab) receives and human-accepts specimen
    await signInAsDemoPersona(page, 'priya');
    await page.goto(`/app/samples/${publicCode}`);
    await page.getByTestId('btn-lab-receive').click();
    await expect(page.getByTestId('passport-action-feedback')).toContainText(/verified/i);

    await page.getByTestId('btn-open-accept-dialog').click();
    await page.getByTestId('confirm-disposition-submit').click();
    await expect(page.getByText(/Accepted by Lab/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('proves offline IndexedDB persistence across reload, reconnect sync, and idempotent UUID replay', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'Offline round-trip & idempotency runs once on desktop project'
    );
    test.setTimeout(90_000);

    // 1. Admin injects duplicate_submission scenario and proves idempotent UUID replay
    await signInAsDemoPersona(page, 'meera');
    await page.goto('/app/demo');

    await page.getByTestId('trigger-scenario-duplicate_submission').click();
    await expect(page.getByTestId('demo-scenario-result')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('replay-duplicate-uuid-btn').click();
    await expect(page.getByTestId('duplicate-replay-proof')).toContainText(
      'idempotent_replay=true'
    );

    // 2. Admin injects offline_courier scenario to prepare a fresh dispatched specimen for Ravi
    await page.getByTestId('trigger-scenario-offline_courier').click();
    await expect(page.getByTestId('demo-scenario-result')).toContainText(/offline/i, {
      timeout: 15_000,
    });
    const resultText = await page.getByTestId('demo-scenario-result').innerText();
    const codeMatch = resultText.match(/SS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}/);
    expect(codeMatch).not.toBeNull();
    const offlineCode = codeMatch![0];

    await signOutCleanly(page);

    // 3. Courier goes offline, queues pickup locally, reloads page, reconnects, and confirms sync
    await signInAsDemoPersona(page, 'ravi');
    await page.goto('/app/handovers');

    await page.getByTestId('handovers-simulate-offline-btn').click();
    await expect(page.getByText(/Offline Queue Active/i)).toBeVisible();

    await page.getByTestId(`pickup-btn-${offlineCode}`).click();

    const queuedRow = page.getByTestId(`queued-item-${offlineCode}-courier_pickup`);
    await expect(queuedRow).toBeVisible();
    await expect(queuedRow).toContainText(/Pending on this device/i);

    // Reload browser while still in offline mode -> IndexedDB must preserve pending item!
    await page.reload();
    await expect(page.getByTestId(`queued-item-${offlineCode}-courier_pickup`)).toContainText(
      /Pending on this device/i
    );

    // Reconnect demo network -> automatic or manual sync confirms with Supabase PostgreSQL
    await page.getByTestId('handovers-simulate-offline-btn').click();
    await expect(page.getByTestId(`queued-item-${offlineCode}-courier_pickup`)).toContainText(
      /Confirmed by server/i,
      { timeout: 20_000 }
    );
  });

  test('verifies mobile scanner manual lookup and thumb navigation bar on 375x812 viewport', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chromium',
      'Mobile thumb-bar & scanner check runs on mobile-chromium viewport'
    );

    await signInAsDemoPersona(page, 'ravi');
    await expect(page.getByRole('navigation', { name: /Mobile quick navigation/i })).toBeVisible();

    await page.goto('/app/scan');
    await page.getByTestId('manual-qr-input').fill('INVALID-QR');
    await page.getByTestId('manual-qr-submit').click();
    await expect(page.getByTestId('scanner-error')).toContainText(/Expected opaque SampleShield format/i);
  });
});
