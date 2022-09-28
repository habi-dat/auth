<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="App erstellen" back >
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
    <v-card-text style="height: 100%; overflow: hidden;">
      <AppForm
        :app="app"
        @valid="onValid"
        showGroups
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import AppForm from '@/components/app/AppForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { AppForm, Toolbar, ToolbarButton },
  data() {
    return {
      app: {},
      valid: false
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      var post = {...this.app};
      post.groups = post.groupsPopulated.map(g => g.dn);
      axios.post('/api/app/create', post)
        .then(response => {
          this.$snackbar.success('App ' + this.app.id + ' erstellt');
          router.push('/app/list')
        })
        .catch(error => {
          console.log('error at creating app: ', error)
        })
    }
  },
  created() {
    this.app = {
      groups: [],
      saml: {}
    }
  }
}
</script>