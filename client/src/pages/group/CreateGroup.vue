<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Gruppe erstellen" back >
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
        :group="group"
        @valid="onValid"
        action="createGroup"
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
  components: { GroupForm, Toolbar, ToolbarButton },
  data() {
    return {
      group: {},
      valid: true,
      loading: false
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      axios.post('/api/group/create', this.group)
        .then(response => {
          this.$snackbar.success('Gruppe ' + this.group.o + ' erstellt')
          this.loading = false;
          router.push('/group/list')
        })
        .catch(errors => {this.loading = false;})
    }
  },
  created() {
    this.group = { member: [], owner: [], subGroups: [], parentGroups: [] }
  }
}
</script>