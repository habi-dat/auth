<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" v-if="loaded" elevation=5>
    <Toolbar :title="'Gruppe ' + group.o" back >
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
     <GroupForm
        v-if="loaded"
        action="openGroup"
        :group="group"
        :showSubgroups="false"
        :showParentgroups="false"
        :showMembers="true"
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import GroupForm from '@/components/group/GroupForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  name: 'UpdateGroup',
  components: { GroupForm, Toolbar, ToolbarButton },
  data() {
    return {
      group: {},
      users: [],
      groups: [],
      loaded: false,
      loading: false
    }
  },
  methods: {
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