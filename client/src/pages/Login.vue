<template>
  <v-container fill-height fluid>
    <v-row justify="center">
      <v-card outlined class="d-inline-block" style="position:relative; top: -20vh;" min-width="800">
        <Toolbar
          title="Login"
          icon="login"
        >
          <template #right>
            <ToolbarButton
              icon="login"
              tooltip="Login"
              color="success"
              :disabled="!valid"
              @click="login"
            />
          </template>
        </Toolbar>
        <v-card-text>
          <v-form id="login-form" method="post" v-model="valid" ref="loginForm">
            <v-text-field
              prepend-icon="person"
              v-model="username"
              label="Login"
              id="username"
              type="text"
              name="username"
              required
            ></v-text-field>
            <v-text-field
              prepend-icon="lock"
              v-model="password"
              label="Password"
              id="password"
              name="password"
              type="password"
              required
            ></v-text-field>
          </v-form>
        </v-card-text>
      </v-card>
    </v-row>
  </v-container>
</template>

<script>
import router from '../router'
import axios from 'axios'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
export default {
  name: 'Login',
  components: { Toolbar, ToolbarButton },
  data () {
    return {
      username: null,
      password: null,
      valid: false
    }
  },
  methods: {
    login: function (e) {
      e.preventDefault()
      let username = this.username
      let password = this.password
      let login = () => {
        let data = {
          username: username,
          password: password
        }
        if (this.$route.query.requestId && this.$route.query.appId) {
          data.requestId = this.$route.query.requestId;
          data.appId = this.$route.query.appId;
        }
        axios.post('/api/login', data)
          .then(response => {
            this.$store.state.config.authenticated = true
            this.$store.state.user = response.data.user
            if (response.data.redirect) {
              document.body.innerHTML=response.data.redirect;
              document.forms[0].submit();
            } else {
              this.$snackbar.success('Eingeloggt als ' + response.data.user.cn)
              if (this.$route.query.returnTo && this.$route.query.returnTo !== '/login' && this.$route.query.returnTo !== '/logout') {
                router.replace({path: this.$route.query.returnTo, query: {dn: this.$route.query.returnToDn}})
              } else {
                router.replace({name: 'Profile'})
              }
            }
          })
          .catch((errors) => {
            console.log('Cannot log in', errors)
          })
      }
      login();
    },
    checkLoggedIn: function () {
      if (this.$store.state.config.authenticated) {
        router.push('/')
      }
    }
  },
  created () {
    this.checkLoggedIn()
  }
}
</script>
