<template>
  <v-row style="height: 100%;">
    <v-col sm="12" md="12">
      <v-form
        ref="form"
        v-model="valid">

        <v-text-field
          prepend-icon="label"
          v-model="settings.title"
          @input="onInput"
          :rules="[v => /^.{3,}$/.test(v) || 'mindestens 3 Zeichen', v => !!v || 'darf nicht leer sein']"
          hint="mindestens 3 Zeichen"
          label="Plattformname"
          required
        />
        <v-checkbox
          v-model="settings.customTheme"
          label="Farbeinstellungen"
          @change="updateTheme"
          @input="onInput"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Primäre Farbe"
          v-model="settings.theme.primary"
          @input="updateTheme"
          :original="$vuetify.theme.themes.original.primary"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Sekundäre Farbe"
          v-model="settings.theme.secondary"
          @input="updateTheme"
          :original="$vuetify.theme.themes.original.secondary"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Akzentfarbe"
          v-model="settings.theme.accent"
          @input="updateTheme"
          :original="$vuetify.theme.themes.original.accent"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Signalfarbe: OK"
          @input="updateTheme"
          v-model="settings.theme.success"
          :original="$vuetify.theme.themes.original.success"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Signalfarbe: Warnung"
          @input="updateTheme"
          v-model="settings.theme.warning"
          :original="$vuetify.theme.themes.original.warning"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Signalfarbe: Fehler"
          @input="updateTheme"
          v-model="settings.theme.error"
          :original="$vuetify.theme.themes.original.error"
        />
        <ColorField
          style="margin-left: 30px;"
          v-if="settings.customTheme"
          icon="format_paint"
          label="Signalfarbe: Info"
          @input="updateTheme"
          v-model="settings.theme.info"
          :original="$vuetify.theme.themes.original.info"
        />
      </v-form>
    </v-col>
  </v-row>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import ColorField from '@/components/form/ColorField'

export default {
  name: "SettingsForm",
  props: {
    value: Object
  },
  components: { ColorField },
  data() {
    return {
      valid: false,
      settings: {}
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue);
    },
  },
  methods: {
    updateTheme() {
      const colors = ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info']
      if (this.settings.customTheme) {
        colors.forEach(color => {
          this.$vuetify.theme.themes.light[color] = this.settings.theme[color];
        })
      } else if (this.$vuetify.theme.themes.original) {
        colors.forEach(color => {
          this.$vuetify.theme.themes.light[color] = this.$vuetify.theme.themes.original[color];
        })
      }
      this.$emit('input', this.settings)
    },
    onInput() {
      this.$emit('input', this.settings)
    }
  },
  created() {
    this.settings = this.value;
  }
}
</script>