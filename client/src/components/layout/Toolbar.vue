<template>
  <v-toolbar flat>
    <slot name="left">
      <v-app-bar-nav-icon>
        <v-icon v-if="!!icon">{{ icon }}</v-icon>
        <v-tooltip v-if="back" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon v-bind="attrs" v-on="on" @click="$router.go(-1)"
            >
              arrow_back
            </v-icon>
          </template>
          Zurück
        </v-tooltip>
      </v-app-bar-nav-icon>

      <v-toolbar-title>{{ title }}</v-toolbar-title>
    </slot>
    <v-spacer />
    <ToolbarSearch v-if="search" :search="searchText" @update:search="value => $emit('update:searchText', value)"/>
    <v-spacer v-if="search && searchPosition !== 'right'"/>
    <slot name="right" />
  </v-toolbar>
</template>

<script>

import ToolbarSearch from '@/components/layout/ToolbarSearch'

export default {
  name: 'Toolbar',
  components: { ToolbarSearch },
  props: {
    title: String,
    icon: String,
    search: Boolean,
    searchText: String,
    searchPosition: String,
    back: Boolean
  },
  methods: {
    onSearchInput(value) {
      this.$emit('update:search', value)
    }
  }
};

</script>