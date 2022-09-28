<template>
  <v-card v-if="loaded" style="margin:0px; padding: 0px;" dark>
    <v-card-title>
      {{ userLoaded.cn }}
    </v-card-title>
    <v-card-subtitle>
      {{ userLoaded.uid}}
    </v-card-subtitle>
    <v-divider />
    <v-divider />
    <v-card-text>
      <v-list>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>night_shelter</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ userLoaded.title }}</v-list-item-title><v-list-item-subtitle>Zugehörigkeit</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>home</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ userLoaded.l }}</v-list-item-title><v-list-item-subtitle>Ort</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>mail</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ userLoaded.mail }}</v-list-item-title><v-list-item-subtitle>E-Mailadresse</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'

export default {
  name: 'GroupTooltip',
  props: {
    user: Object
  },
  data() {
    return {
      loaded: false,
      userLoaded: {}
    }
  },
  methods: {
    getUser: function () {
      return axios.get('/api/user/' + this.user.dn)
        .then(response => {
          this.userLoaded = response.data.user;
          this.loaded = true
          return;
        })
        .catch(error => {})
    }
  },
  created() {
    if (this.user && this.user.dn && !this.user.uid) {
      this.getUser();
    } else {
      this.userLoaded = this.user;
      this.loaded = true;
    }
  }
};

</script>
