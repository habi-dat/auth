<template>
  <v-card v-if="loaded" style="margin:0px; padding: 0px;" dark>
    <v-card-title>
      {{ groupsLoaded.o }}
    </v-card-title>
    <v-card-subtitle>
      {{ groupsLoaded.cn}}
    </v-card-subtitle>
    <v-divider />
    <v-card-subtitle v-if="!!groupsLoaded.description">
      {{ groupsLoaded.description}}
    </v-card-subtitle>
    <v-divider v-if="!!groupsLoaded.description"/>
    <v-card-text>
      <v-list>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>groups</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ groupsLoaded.member.length  }}</v-list-item-title><v-list-item-subtitle>Mitglieder</v-list-item-subtitle></v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-icon>
            <v-icon>edit</v-icon>
          </v-list-item-icon>
          <v-list-item-content><v-list-item-title>{{ getAdmins() }}</v-list-item-title><v-list-item-subtitle>Admin@s</v-list-item-subtitle></v-list-item-content>
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
    group: String
  },
  data() {
    return {
      loaded: false,
      groupsLoaded: {}
    }
  },
  methods: {
    getGroup (dn) {
      return axios.create().get('/api/group/' + dn)
        .then(response => {
          this.groupsLoaded = response.data.group;
          this.loaded = true
          return;
        })
        .catch(error => {})
    },
    getAdmins() {
      if (this.groupsLoaded && this.groupsLoaded.owner && this.groupsLoaded.owner.length > 0) {
        if (typeof this.groupsLoaded.owner[0] === 'string') {
          return this.groupsLoaded.owner.map(g => g.split(',')[0].split('=')[1]).join(', ')
        } else {
          return this.groupsLoaded.owner.map(g => g.cn).join(', ')
        }
      } else {
        return 'keine'
      }
    }
  },
  created() {
    if (this.group) {
      this.getGroup(this.group);
    } else {
      this.groupsLoaded = this.group;
      this.loaded = true;
    }
  }
};

</script>
