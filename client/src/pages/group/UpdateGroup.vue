<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" v-if="loaded">
    <Toolbar :title="'Gruppe ' + group.o + ' bearbeiten'" back >
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
     <GroupForm
        v-if="loaded"
        @valid="onValid"
        action="updateGroup"
        :group="group"
        showSubgroups="true"
        showParentgroups="true"
        showMembers="true"
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import GroupForm from '@/components/group/GroupForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  name: 'UpdateGroup',
  components: { GroupForm, Toolbar, ToolbarButton },
  data() {
    return {
      group: {},
      valid: true,
      users: [],
      groups: [],
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
      axios.post('/api/group/update', this.group)
        .then(response => {
          this.loading = false;
          if (response.data.status === 'success') {
            this.$snackbar.success(response.data.message)
          } else {
            this.$snackbar.warning(response.data.message)
          }
          router.push('/group/list')
        })
        .catch(errors => {this.loading=false;})
    },
    getData: function () {
      return axios.get('/api/group/' +  this.$route.query.dn)
        .then(response => {
          this.group = response.data.group
          this.loaded = true;
        })
        .catch(e => {this.loading=false;});
    }
  },
  async created() {
    await this.getData();
  }
}
</script>