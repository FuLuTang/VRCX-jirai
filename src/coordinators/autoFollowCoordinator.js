import { ref } from 'vue';

export const isAutoFollowDialogOpen = ref(false);

export function openAutoFollowDialog() {
    isAutoFollowDialogOpen.value = true;
}

export function closeAutoFollowDialog() {
    isAutoFollowDialogOpen.value = false;
}

