<template>
  <v-card outlined style="display: flex; flex-direction:column"  min-width="800" >
    <Toolbar title="Einstellungen" back >
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <SettingsForm
        v-if="loaded"
        v-model="settings"
        @valid="onValid"
        action="create"
        showGroups
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import SettingsForm from '@/components/settings/SettingsForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { SettingsForm, Toolbar, ToolbarButton },
  data() {
    return {
      valid: false,
      settings: {},
      loaded: false,
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      var post = {...this.settings};
      axios.post('/api/settings', post)
        .then(response => {
          this.$snackbar.success('Einstellungen geändert')
        })
        .catch(error => {
          console.log('error at updating settings: ', error)
        })
    },
    getData: function () {
      return axios.get('/api/settings')
        .then(response => {
          this.settings = response.data.settings;
          this.settings.title = this.settings.title || this.$store.state.config.title;
          this.settings.theme.primary = this.settings.theme.primary || this.$vuetify.theme.themes.light.primary;
          this.settings.theme.secondary = this.settings.theme.secondary || this.$vuetify.theme.themes.light.secondary;
          this.settings.theme.accent = this.settings.theme.accent || this.$vuetify.theme.themes.light.accent;
          this.settings.theme.success = this.settings.theme.success || this.$vuetify.theme.themes.light.success;
          this.settings.theme.warning = this.settings.theme.warning || this.$vuetify.theme.themes.light.warning;
          this.settings.theme.error = this.settings.theme.error || this.$vuetify.theme.themes.light.error;
          this.settings.theme.info = this.settings.theme.info || this.$vuetify.theme.themes.light.info;
          this.loaded = true;
        })
    }
  },
  created() {
    this.getData();
  }
}
</script>