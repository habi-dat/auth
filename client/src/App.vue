<template>
  <v-app id="inspire" v-if="initialized">
    <Snackbar></Snackbar>
    <v-navigation-drawer app dark permanent clipped color="secondary" class="elevation-3 " :mini-variant="$vuetify.breakpoint.mdAndDown">
      <template v-slot:prepend v-if="!isIframe()">
        <v-list-item two-line>
          <v-list-item-avatar size="40px" style="position: relative; left:-7px">
            <v-img :src="require('@/assets/img/habidat.png')"></v-img>
          </v-list-item-avatar>
          <v-list-item-title v-if="$store.state.config.authenticated">{{$store.state.user.cn }}</v-list-item-title>
          <v-list-item-title v-if="!$store.state.config.authenticated">{{$store.state.config.title }}</v-list-item-title>
        </v-list-item>
      </template>
      <v-divider v-if="!isIframe()" />
      <v-list dense>
        <v-list-item to="/" v-if="$store.state.config.authenticated">
          <v-list-item-icon><v-icon>person</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Profil</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/invites" v-if="$store.state.config.authenticated && $store.state.user.isGroupAdmin">
          <v-list-item-icon><v-icon>email</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Einladungen</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/user/list" v-if="$store.state.config.authenticated && $store.state.user.isGroupAdmin">
          <v-list-item-icon><v-icon>group</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Accounts</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/group/list" v-if="$store.state.config.authenticated">
          <v-list-item-icon><v-icon>groups</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Gruppen</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/category/list" v-if="$store.state.config.authenticated && $store.state.user.isAdmin">
          <v-list-item-icon><v-icon>forum</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Kategorien</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/app/list" v-if="$store.state.config.authenticated && $store.state.user.isAdmin">
          <v-list-item-icon><v-icon>category</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Apps</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/settings" v-if="$store.state.config.authenticated && $store.state.user.isAdmin">
          <v-list-item-icon><v-icon>settings</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Einstellungen</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/templates" v-if="$store.state.config.authenticated && $store.state.user.isAdmin">
          <v-list-item-icon><v-icon>email</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>E-Mail Vorlagen</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/audit" v-if="$store.state.config.authenticated && $store.state.user.isAdmin">
          <v-list-item-icon><v-icon>history</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Logbuch</v-list-item-title></v-list-item-content>
        </v-list-item>        
        <v-divider  v-if="!isIframe() && $store.state.myApps && $store.state.myApps.length > 0"></v-divider>
        <v-list-item  v-if="!isIframe() && $store.state.myApps && $store.state.myApps.length > 0" :href="app.url" target="_blank" v-for="app in $store.state.myApps">
          <v-list-item-icon><v-icon >open_in_new</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ app.label }}</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-divider v-if="!isIframe() && $store.state.myApps && $store.state.myApps.length > 0"></v-divider>
        <v-list-item to="/login" v-if="!$store.state.config.authenticated">
          <v-list-item-icon><v-icon>login</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Login</v-list-item-title></v-list-item-content>
        </v-list-item>
        <v-list-item to="/logout" @click="logout" v-if="$store.state.config.authenticated && !isIframe()">
          <v-list-item-icon><v-icon>logout</v-icon></v-list-item-icon>
          <v-list-item-content><v-list-item-title>Logout</v-list-item-title></v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <v-container fluid fill-height style="align-items: start;" class="grey lighten-4" >
      <!-- Display view pages here based on route -->
        <router-view></router-view>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import Snackbar from '@/components/Snackbar.vue'
import axios from 'axios'
import router from './router'

export default {
  components: { Snackbar },
  name: 'App',
  metaInfo: {
    htmlAttrs: {
      lang: 'de-DE'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },  
  data () {
    return {
      initialized: false
    }
  },
  methods: {
    isIframe() {
      return window.location !== window.parent.location;
    },
    logout: function (e) {
      var self = this;
      axios
        .get('/api/logout')
        .then(response => {
          self.$store.state.config.authenticated = false;
          self.$store.state.user = {};
          self.$store.state.myApps = [];
          if (response.data.redirect) {
            window.location.href=response.data.redirect;
          } else {
            router.push('/login')
          }
        })
    },
    getConfig: function () {
      let self = this
      axios.get('/api/config')
        .then(response => {
          self.$store.state.config = response.data.config
          document.title = response.data.config.title;
          self.$store.state.user = response.data.user || {}
          if (response.data.config.authenticated) {
            self.$store.state.myApps = response.data.apps
          }
          /*if (!response.data.config.authenticated && router.currentRoute.path !== '/login') {
            router.push('/login')
          }*/
          this.$vuetify.theme.themes.original = {...this.$vuetify.theme.themes.light}
          if (response.data.config.settings.customTheme) {

            ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info'].forEach(color => {
              this.$vuetify.theme.themes.light[color] = response.data.config.settings.theme[color] || this.$vuetify.theme.themes.light[color];
              });
          }
          this.initialized = true;    
          
        })
        .catch(() => {})
    },   
    setupInterceptor: function () {
      var self = this;
      axios.interceptors.response.use(function (response) {
        return response
      }, function (error) {
        if (error.response) {
          if (error.response.status === 400) {
            self.$snackbar.error(error.response.data.message || error.response.data.error.message)
          } else if (error.response.status === 404) {
            console.log('404 error (interceptor)', error)
            self.$snackbar.error("Server API Endpoint nicht gefunden");
          }
          if (error.response.status === 401) {
            // if you ever get an unauthorized, logout the user
            self.$snackbar.error('Nicht eingeloggt')
            self.$store.state.config.authenticated = false;
            router.push('/')
          }
          if (error.response.status === 500) {
            self.$snackbar.error('Serverfehler: ' + error.response.data.error.message)
          }
        }
        //return;
        return Promise.reject(error);
      })
    }
  },
  created () {
    this.setupInterceptor()
    this.getConfig()
  }
}
</script>

<style>
  #app {
    font-family: 'Avenir', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
  }
</style>
