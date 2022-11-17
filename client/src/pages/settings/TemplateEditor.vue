<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
    <Toolbar>
      <template #left>
        <v-tabs
          v-model="tab"
          left
          icons-and-text>
          <v-tabs-slider></v-tabs-slider>
          <v-tab href="#tab-invite">
            Einladung
            <v-icon>send</v-icon>
          </v-tab>
          <v-tab href="#tab-passwordreset">
            Passwort Zurücksetzen
            <v-icon>mail_lock</v-icon>
          </v-tab>
        </v-tabs>
      </template>
      <template #right>
        <ToolbarButton
          v-if="tab === 'tab-invite'"
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading.invite"
          @click="saveInvite"
          :disabled="!valid.invite"
        />
        <ToolbarButton
          v-if="tab === 'tab-passwordreset'"
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading.passwordReset"
          @click="savePasswordReset"
          :disabled="!valid.passwordReset"
        />
      </template>
    </Toolbar>

    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <v-tabs-items v-model="tab" style="height: 100%; min-height: 400px; overflow: hidden;">
        <v-tab-item key="1" value="tab-invite" style="height: 100%; min-height: 400px; overflow: hidden;">
          <TemplateForm
            v-if="loaded"
            id="invite"
            :template="templates.invite"
            @editorReady="onInviteEditorReady"
            @valid="onValidInvite"
          />
        </v-tab-item>
        <v-tab-item key="2" value="tab-passwordreset" style="height: 100%; min-height: 400px; overflow: hidden;">
          <TemplateForm
            v-if="loaded"
            id="passwordReset"
            :template="templates.passwordReset"
            @editorReady="onPasswordResetEditorReady"
            @valid="onValidPasswordReset"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
import TemplateForm from '@/components/settings/TemplateForm'


export default {
  components: { Toolbar, ToolbarButton, TemplateForm },
  data() {
    return {
      valid: { invite: false, passwordReset: false},
      editors: {intive: null, passwordReset: null},
      loaded: false,
      loading: {invite: false, passwordReset: false},
      tab: undefined,
      templates: {
        invite: {activated: false, subject: '', body: ''},
        passwordReset: {activated: false, subject: '', body: ''},
      },
    }
  },
  methods: {
    onValidInvite (valid) {
      this.valid.invite = valid;
    },
    onValidPasswordReset (valid) {
      this.valid.passwordReset = valid;
    },
    onPasswordResetEditorReady (editor) {
      this.editors.passwordReset = editor;
    },
    onInviteEditorReady (editor) {
      this.editors.invite = editor;
    },
    saveInvite() {
      var htmlWithCss = this.templates.invite.body;
      if (this.templates.invite.activated && this.editors.invite) {
        htmlWithCss = this.editors.invite.runCommand('gjs-get-inlined-html');
      }
      return axios.post('/api/email/templates', {template: 'invite', activated: this.templates.invite.activated, subject: this.templates.invite.subject, body: htmlWithCss})
        .then(response => {
          this.$snackbar.success('Einstellungen gespeichert')
        })
        .catch(e => {})
    },
    savePasswordReset() {
      var htmlWithCss = this.templates.passwordReset.body;
      if (this.templates.passwordReset.activated && this.editors.passwordReset) {
        htmlWithCss = this.editors.passwordReset.runCommand('gjs-get-inlined-html');
      }
      return axios.post('/api/email/templates', {template: 'passwordReset', activated: this.templates.passwordReset.activated, subject: this.templates.passwordReset.subject, body: htmlWithCss})
        .then(response => {
          this.$snackbar.success('Einstellungen gespeichert')
        })
        .catch(e => {})
    },
    getData() {
      return axios.get('/api/email/templates')
        .then(response => {
          this.templates = response.data.templates;
          this.loaded = true;
        })
        .catch(e => {})
    }
  },
  created() {
    this.getData();
  }
}
</script>
