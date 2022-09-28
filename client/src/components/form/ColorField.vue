<template>
  <v-text-field 
    :prepend-icon="icon || 'format_paint'"
    :rules="[v => /^#[0-9A-F]{6,6}$/.test(v) || 'kein gültiger Farbcode']"
    v-model="color"
    @input="val => $emit('input', val)"
    :label="label || 'Farbe'"
    :append-outer-icon="original?'undo':''"
    @click:append-outer="onAppendOuter"
    >
    <template #append>
      <v-menu v-model="menu" top nudge-bottom="105" nudge-left="16" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <v-icon :color="color" v-on="on">square</v-icon>
        </template>
        <v-card>
          <v-card-text class="pa-0">
            <v-color-picker 
              v-model="color"
              @input="val => $emit('input', val)" 
              flat 
            />
          </v-card-text>
        </v-card>
      </v-menu>
    </template>
  </v-text-field>
</template>
  
<script>

import axios from 'axios'

export default {
  name: 'ColorField',
  data() {
    return {
      menu: null,
      color: ''
    }
  },
  props: {
    value: String,
    icon: String,
    label: String,
    original: String,
  },
  methods: {
    onAppendOuter() {
      this.color = this.original;
      this.$emit('input', this.color);
    }
  },
  created() {
    this.color = this.value;
  }
};
  
</script>