<template>
  <v-tooltip bottom>
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        v-bind="attrs" v-on="on"
        tile
        elevation="2"
        :to="to"
        :color="color"
        :disabled="disabled"
        :loading="loading"
        style="margin-left: 5px;"
        @click="clickHandler"
      >
        <v-icon>{{ icon }}</v-icon>
        {{ label }}
      </v-btn>
    </template>
    {{ tooltip }}
  </v-tooltip>
</template>

<script>

export default {
  name: 'ToolbarButton',
  props: {
    to: String,
    color: String,
    icon: String,
    label: String,
    tooltip: String,
    disabled: Boolean,
    loading: Boolean
  },
  methods: {
    clickHandler(event) {
      this.$emit('click', event)
    }
  }
};

</script>