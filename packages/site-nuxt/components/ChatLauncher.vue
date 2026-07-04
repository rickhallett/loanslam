<template>
  <div>
    <button
      id="mal-launcher"
      type="button"
      :aria-label="isOpen ? `Close ${chatTitle}` : `Open ${chatTitle}`"
      :aria-expanded="isOpen"
      @click="togglePanel"
    >
      <svg
        v-if="!isOpen"
        viewBox="0 0 24 24"
        aria-hidden="true"
        class="mal-icon"
      >
        <path
          d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="mal-icon">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>

    <ChatWidgetPanel
      v-if="panelLoaded"
      :is-open="isOpen"
      :route-finder-topic="pendingTopic"
      :open-request-id="openRequestId"
      @close="closePanel"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

interface RouteFinderTopic {
  eyebrow?: string;
  title: string;
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

const ChatWidgetPanel = defineAsyncComponent(
  () => import("./ChatWidgetPanel.vue"),
);

const route = useRoute();
const isOpen = ref(false);
const panelLoaded = ref(false);
const pendingTopic = ref<RouteFinderTopic | null>(null);
const openRequestId = ref(0);
const chatTitle = computed(() =>
  normalizePath(route.path) === "/contact"
    ? "Find the right team"
    : "MAL Loans assistant",
);

async function openPanel(topic: RouteFinderTopic | null = null): Promise<void> {
  pendingTopic.value = topic;
  panelLoaded.value = true;
  isOpen.value = true;
  openRequestId.value += 1;
  await nextTick();
}

function closePanel(): void {
  isOpen.value = false;
}

function togglePanel(): void {
  if (isOpen.value) closePanel();
  else void openPanel();
}

function handleRouteFinderOpen(event: Event): void {
  const topic =
    (event as CustomEvent<{ topic?: RouteFinderTopic }>).detail?.topic ?? null;
  void openPanel(topic);
}

function syncBodyClass(open: boolean): void {
  if (import.meta.client) {
    document.body.classList.toggle("mal-open", open);
  }
}

watch(isOpen, syncBodyClass, { immediate: true });

onMounted(() => {
  window.addEventListener("mal:open-route-finder", handleRouteFinderOpen);
});

onBeforeUnmount(() => {
  window.removeEventListener("mal:open-route-finder", handleRouteFinderOpen);
  if (import.meta.client) document.body.classList.remove("mal-open");
});
</script>

<style src="../assets/chat-launcher.css"></style>
