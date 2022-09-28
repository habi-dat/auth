<template>
  <v-text-field
    prepend-icon="search"
    label="Suchen..."
    :value="search"
    @input="value => $emit('update:search', value)"
    single-line
    hide-details
    style="max-width: 300px;"
  />
</template>

<script>

export default {
  name: 'ToolbarSearch',
  props: {
    search: String
  }
};

</script>