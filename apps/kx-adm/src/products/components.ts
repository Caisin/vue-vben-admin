import { defineAsyncComponent } from 'vue';

const productFormComponents = {
  SimCardSelect: defineAsyncComponent(
    () => import('../components/management/sim-card-select.vue'),
  ),
};

export { productFormComponents };
