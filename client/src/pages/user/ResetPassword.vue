<template>

  <v-card outlined class="d-inline-block" width="800">
    <Toolbar title="Passwort zurücksetzen" back infoText="Gib deine E-Mailadresse an und du bekommst einen Link zum Zurücksetzen deines Passworts.">
      <template #right>
        <ToolbarButton
          icon="send"
          tooltip="E-Mail senden"
          :loading="loading"
          color="success"
          @click="send"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text>
      <v-form
        ref="form"
        v-model="valid"
      >
        <EmailField
          v-model="mail"
        />
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '../../router'
import EmailField from '@/components/form/EmailField'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  name: 'ChangePassword',
  components: { EmailField, Toolbar, ToolbarButton },
  data() {
    return {
      valid: true,
      mail: '',
      loading: false
    }
  },
  methods: {
    send: function () {
      this.loading = true;
      var post = {
        mail: this.mail
      }
      axios.post('/api/user/resetpassword', post)
        .then(response => {
          this.loading = false;
          this.$snackbar.success('Eine E-Mail mit einem Link zum Zurücksetzen des Passworts wurde an ' + this.mail + ' verschickt')
          router.push('/login')
        })
        .catch(e => {
          this.loading = false;
        });
    }
  }
}
</script>