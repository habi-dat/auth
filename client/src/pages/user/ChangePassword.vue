<template>

  <v-card outlined class="d-inline-block" min-width="800">
    <Toolbar title="Passwort ändern" back>
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
    <v-card-text>
      <PasswordForm
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
      valid: true,
      loaded: false
    }
  },
  methods: {
    save: function () {
      var post = {
        currentPassword: this.currentPassword,
        password: this.password
      }
      // if changing other users password add user dn
      if (this.user && this.user.dn) {
        post.dn = this.user.dn
      }
      axios.post('/api/user/password', post)
        .then(response => {
          if (this.user) {
            router.push('/user/list')
          } else {
            router.push('/profile')
          }
        });
    },
    getUser: function () {
      return axios.get('/api/user/' +  this.$route.query.dn)
        .then(response => {
          this.user = response.data.user;
          this.loaded = true;
          return;
        })
        .catch(error => {})
    },
  },
  created() {
    if (this.$route.query.dn) {
      this.getUser();
    } else {
      this.loaded = true;
    }
  }
}
</script>