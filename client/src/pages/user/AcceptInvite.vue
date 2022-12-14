<template>
  <v-card outlined class="d-inline-block" width="800" elevation=5>
    <Toolbar title="Account erstellen" icon="person">
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <UserForm
        v-if="loaded"
        :user="user"
        @valid="onValid"
        action="createUser"
        showPassword
        allowUid
        :token="$route.query.token"
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import UserForm from '@/components/user/UserForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { UserForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: {},
      valid: true,
      loading: false,
      loaded: false,
      token: undefined,
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    isURL(str) {
      let url;

      try {
        url = new URL(str);
      } catch (_) {
        return false;
      }

      return url.protocol === "http:" || url.protocol === "https:";
    },
    save: function () {
      this.loading = true;
      axios.post('/api/user/acceptinvite/' + this.$route.query.token, this.user)
        .then(response => {
          this.loading = false;
          if (this.$store.state.config.authenticated) {
            this.$snackbar.success('Account ' + this.user.cn + ' erstellt, logge dich aus um dich mit dem neuen Account einzuloggen', 6000)
            router.push('/')
          } else if (this.$store.state.config.settings.entryUrl && this.isURL(this.$store.state.config.settings.entryUrl)) {
            this.$snackbar.success('Account ' + this.user.cn + ' erstellt, du wirst in Kürze zum Login weitergeleitet', 6000)
            setTimeout(window.location.replace(this.$store.state.config.settings.entryUrl), 8000);
          } else {
            this.$snackbar.success('Account ' + this.user.cn + ' erstellt, du kannst dich jetzt einloggen', 6000)
            router.push('/login')
          }
        })
        .catch(errors => {
          this.loading = false;
        })
    },
    getToken() {
      return axios.get('/api/user/invite/' +  this.$route.query.token)
        .then(response => {
          if (response.data.valid) {
            this.user = response.data.user;
            this.user.preferredLanguage = 'de';
            this.user.description = '1 GB';
            this.loaded = true;
          } else {
            this.$snackbar.error('Der Link ist leider abgelaufen oder ungültig. Bitte kontaktiere die Person die dich eingeladen hat.')
            router.push('/login');
          }
          return;
        })
        .catch(error => {})
    }
  },
  created() {
    this.getToken();
  }
}
</script>