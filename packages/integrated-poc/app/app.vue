<template>
  <main class="poc-shell">
    <section class="workspace">
      <div class="customer-pane" aria-label="Customer support journey">
        <header class="pane-header">
          <p class="eyebrow">Integrated POC</p>
          <h1>Customer support journey</h1>
        </header>

        <div class="journey-status">
          <span>Application help</span>
          <span>Safe handoff path</span>
          <span>Admin readback</span>
        </div>

        <section class="conversation" aria-label="Conversation">
          <article class="message assistant">
            <p>
              Ask a support or handoff-shaped question. This surface will route
              the turn through the current engine path before recording the thin
              ticket context for the admin view.
            </p>
          </article>
        </section>

        <form class="composer" aria-label="Send support message">
          <label for="support-message">Message</label>
          <textarea
            id="support-message"
            rows="4"
            value="I need help with my loan application and would like someone to contact me."
          />
          <button type="button">Send through engine</button>
        </form>
      </div>

      <aside class="admin-pane" aria-label="Admin readback">
        <header class="pane-header">
          <p class="eyebrow">Human agent</p>
          <h2>Ticket readback</h2>
        </header>

        <div class="empty-state">
          <strong>No ticket context yet</strong>
          <p>
            Once a customer turn creates mock support context, this pane will list
            the ticket receipt and the safe handoff summary.
          </p>
        </div>
      </aside>
    </section>
  </main>
</template>
