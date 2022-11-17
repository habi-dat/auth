<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
    <Toolbar :title="'App ' + app.id + ' bearbeiten'" back >
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
      <AppForm
        v-if="loaded"
        :app="app"
        @valid="onValid"
        action="create"
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
      valid: false,
      loaded: false,
      loading: false
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      var post = {...this.app};
      post.groups = post.groupsPopulated.map(g => g.dn);
      axios.post('/api/app/update', post)
        .then(response => {
          this.$snackbar.success('App ' + this.app.id + ' geändert')
          this.loading = false;
          router.push('/app/list')
        })
        .catch(error => {this.loading=false; })
    },
    getData: function () {
      return axios.get('/api/app/' + this.$route.query.id)
        .then(response => {
          this.app = response.data.app;
          this.loaded = true;
        })
        .catch(e => {})
    }
  },
  created() {
    this.getData();
  }
}
</script>