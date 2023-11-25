<template>
  <v-container fill-height fluid style="padding:0px; margin: 0px -30px;">
    <v-row style="padding-right: 40px; padding-bottom: 40vh">
      <v-card outlined class="d-inline-block" style="position:relative; top: 90px; left:max(calc((100% - 1056px) / 2), 50px); margin-bottom: 150px; margin-left: 30px; " width="800" elevation="5">
        <Toolbar
          :title="$store.state.config.title"
        >
          <template #icon>
            <v-tooltip right>
              <template v-slot:activator="{ on, attrs }">
                <v-img v-bind="attrs" v-on="on" width="80px" @mouseover.prevent="getQuote" :src="require('@/assets/img/habidat.png')" style="position: relative; left:-25px; top:-15px; filter: drop-shadow(4px 4px 4px rgba(0, 0, 0, 0.5));"></v-img>
              </template>
              {{ quote }}
            </v-tooltip>
          </template>
        </Toolbar>
        <v-card-text>
          <v-form id="login-form" method="post" v-model="valid" ref="loginForm">
            <v-text-field
              prepend-icon="person"
              v-model="username"
              label="Username / E-Mailadresse"
              id="username"
              type="text"
              name="username"
              @keyup.enter="login"
              required
            ></v-text-field>
            <v-text-field
              prepend-icon="lock"
              v-model="password"
              label="Passwort"
              id="password"
              name="password"
              type="password"
              @keyup.enter="login"
              required
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn text color="info" to="/user/password/reset">
            Passwort vergessen?
          </v-btn>
          <v-spacer />
          <ToolbarButton
              icon="login"
              tooltip="Login"
              color="success"
              :loading="loading"
              :disabled="!valid"
              @click="login"
            />          
        </v-card-actions>
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
  metaInfo: {
    meta: [
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=0.9' }
    ]
  },   
  data () {
    return {
      username: null,
      password: null,
      valid: false,
      loading: false,
      quote:''
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
        this.loading = true;
        axios.post('/api/login', data)
          .then(response => {
            this.loading = false;
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
          .catch(errors => {
            this.loading = false;
          })
      }
      login();
    },
    checkLoggedIn: function () {
      if (this.$store.state.config.authenticated) {
        router.push('/')
      }
    },
    getQuote() {
      const quotes = [
        "Wessen Daten? Unsere Daten!",
      ]
      this.quote = quotes[Math.floor(Math.random() * quotes.length)]
    }
  },
  created () {
    if (this.$route.query.logout) {
      this.$store.state.config.authenticated = false;
    }
    this.checkLoggedIn()
  }
}
</script>
