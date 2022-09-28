// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import Vuex from 'vuex'
import vuetify from '@/plugins/vuetify'
import snackbarPlugin from '@/plugins/snackbar';
import App from './App'
import router from './router'

Vue.config.productionTip = false

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    user: {},
    config: {},
    notification: {
      content: '',
      color: 'info',
      timeout: 4000,
      icon: 'info',
      title: 'Info'
    },
    returnTo: {}
  },
  mutations: {
    showMessage (state, payload) {
      state.notification.content = payload.content
      state.notification.color = payload.color
      state.notification.title = payload.title
      state.notification.timeout = payload.timeout
      state.notification.icon = payload.icon
    }
  }
})

Vue.use(snackbarPlugin, { store })

/* eslint-disable no-new */
new Vue({
  el: '#app',
  vuetify,
  router,
  store,
  components: { App },
  template: '<App/>',
})
