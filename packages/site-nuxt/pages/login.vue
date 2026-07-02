<template>
  <div>
    <div class="page-head login-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb"><a href="/">Home</a> / Log in</p>
        <h1>Existing customer login</h1>
        <p>Account entry and support routes for existing Loans by MAL customers.</p>
      </div>
    </div>

    <LoginPanel />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Log in to your Loans by MAL account',
  meta: [
    {
      name: 'description',
      content: 'Existing customer account access for the rebuilt Loans by MAL website.',
    },
  ],
});
</script>
