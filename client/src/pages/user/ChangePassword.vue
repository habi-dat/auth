<template>
  <v-card outlined class="d-inline-block" width="800" elevation=5>
    <Toolbar :title="title" :back="!token" :icon="token?'key':undefined">
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          :loading="loading"
          color="success"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text>
      <PasswordForm
        :password.sync="password"
        :currentPassword.sync="currentPassword"
        :checkPassword="!!!token"
        v-if="loaded"
        @valid="valid => { this.valid = valid}"
        :user=user
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '../../router'
import PasswordForm from '@/components/user/PasswordForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  name: 'ChangePassword',
  components: { PasswordForm, Toolbar, ToolbarButton },
  data() {
    return {
      user: undefined,
      token: undefined,
      valid: true,
      loaded: false,
      loading: false,
      currentPassword: '',
      password: '',
      title: ''
    }
  },
  methods: {
    save: function () {
      this.loading = true;
      var data = {
        password: this.password
      }
      var endpoint;
      if (this.token) {
        data.token = this.token;
        endpoint = '/api/user/setpassword';
      } else {
        data.currentPassword = this.currentPassword;
        endpoint = '/api/user/changepassword';
      }
      // if changing other users password add user dn
      if (this.user && this.user.dn) {
        data.dn = this.user.dn
      }
      axios.post(endpoint, data)
        .then(response => {
          this.loading = false;
          this.$snackbar.success('Passwort geändert')
          if (this.user) {
            router.push('/user/list')
          } else if (this.token) {
            router.push('/login')
          } else {
            router.push('/')
          }
        })
        .catch(error => {
          this.loading = false;
        })
    },
    getUser: function () {
      return axios.get('/api/user/' +  this.$route.query.dn)
        .then(response => {
          this.user = response.data.user;
          this.title = "Passwort für " + this.user.cn + " ändern"
          this.loaded = true;
          return;
        })
        .catch(error => {})
    },
  },
  created() {
    if (this.$route.query.dn) {
      this.getUser();
    } else if(this.$route.query.token) {
      this.title="Passwort zurücksetzen"
      this.token = this.$route.query.token;
      this.loaded = true;
    } else {
      this.title="Passwort ändern"
      this.loaded = true;
    }
  }
}
</script>