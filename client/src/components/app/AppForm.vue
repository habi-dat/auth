<template>
  <v-row style="height: 100%;">
    <v-col sm="12" md="4">
      <v-form
        v-if="loaded"
        ref="form"
        v-model="valid">

        <v-text-field
          prepend-icon="label"
          v-model="app.id"
          :rules="[v => /^.{3,}$/.test(v) || 'mindestens 3 Zeichen', v => !!v || 'darf nicht leer sein']"
          hint="mindestens 3 Zeichen"
          label="ID"
          required
        />
        <v-text-field
          prepend-icon="label"
          v-model="app.label"
          :rules="[v => /^.{3,}$/.test(v) || 'mindestens 3 Zeichen', v => !!v || 'darf nicht leer sein']"
          hint="mindestens 3 Zeichen"
          label="Name"
          required
        />
        <v-text-field
          prepend-icon="link"
          v-model="app.url"
          :rules="[v => isURL(v) || 'keine gültige URL', v => !!v || 'darf nicht leer sein']"
          label="URL"
          required
        />
        <v-select
          :items="icons"
          v-model="app.icon"
          label="Icon">
          <template v-slot:item="{ active, item, attrs, on }">
            <v-list-item v-on="on" v-bind="attrs" >
              <v-list-item-icon >
                <img :src="'http://localhost:3000'+item.url" width="24" :style="'background-color: ' + $vuetify.theme.themes.light.secondary"/>
              </v-list-item-icon>
              <v-list-item-content>
                  {{ item.name }}
              </v-list-item-content>
            </v-list-item>
          </template>
          <template #prepend>
            <v-container  style="padding:0px">
            <img  width="24" :src="'http://localhost:3000'+app.icon.url" :style="'background-color: ' + $vuetify.theme.themes.light.secondary"/>
          </v-container>
          </template>
          <template v-slot:selection="{ item }">
            {{ item.name }}
          </template>
        </v-select>
        <v-checkbox
          v-model="app.saml.samlEnabled"
          label="Single Sign On"
        />
        <v-text-field
          style="margin-left: 30px;"
          v-if="app.saml.samlEnabled"
          prepend-icon="label"
          v-model="app.saml.entityId"
          label="Entity ID"
        />
        <v-text-field
          style="margin-left: 30px;"
          v-if="app.saml.samlEnabled"
          prepend-icon="link"
          v-model="app.saml.acs"
          label="Assertion Consumer Service Endpoint"
        />
        <v-text-field
          style="margin-left: 30px;"
          v-if="app.saml.samlEnabled"
          prepend-icon="link"
          v-model="app.saml.slo"
          label="Single Logout Endpoint"
        />
        <v-textarea
          style="margin-left: 30px;"
          v-if="app.saml.samlEnabled"
          prepend-icon="security"
          v-model="app.saml.certificate"
          label="Zertifikat" />
        <MemberField
          v-if="showGroups"
          icon="groups"
          label="Berechtigte Gruppen"
          v-model="app.groupsPopulated"
          @input="selectGroups"
          itemText="o"
          itemValue="cn"
          tooltip="group"
          close
        />
      </v-form>
    </v-col>
    <v-divider vertical />
    <v-col md="" sm="12" minHeight="400" style="height: 100%; min-height: 400px; overflow: hidden;">
      <Toolbar title="Gruppenberechtigungen" icon="groups" search searchPosition="right" :searchText.sync="search"/>
      <GroupTable
        v-if="loaded"
        :groups="groups"
        :search="search"
        @selectGroup="onSelectGroup"
        @onGridReady="params => groupGripApi = params.api"
        @onDataRendered="selectGroups"
        rowSelection="multiple"
        :heightOffset="30" />
    </v-col>
  </v-row>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import MemberField from '@/components/form/MemberField'
import GroupTable from '@/components/group/GroupTable'
import Toolbar from '@/components/layout/Toolbar'

export default {
  name: "AppForm",
  props: {
    app: Object,
    showGroups: Boolean
  },
  components: { MemberField, GroupTable, Toolbar },
  data() {
    return {
      languages: [{text: 'Deutsch', value: 'de'}, {text: 'English', value: 'en'}],
      search: '',
      groups: [],
      valid: false,
      loaded: false,
      imageUrl: "",
      icons: []
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue);
    }
  },
  methods: {
    isURL(str) {
      let url;

      try {
        url = new URL(str);
      } catch (_) {
        return false;
      }

      return url.protocol === "http:" || url.protocol === "https:";
    },
    onSelectGroup: function(group, selected) {
      if (selected && !this.app.groupsPopulated.find(g => g.dn === group.dn)) {
        this.app.groupsPopulated.push(group);
      } else if (!selected && this.app.groupsPopulated.find(g => g.dn === group.dn)) {
        this.app.groupsPopulated.splice(this.app.groupsPopulated.findIndex(g => g.dn === group.dn), 1);
      }
    },
    selectGroups() {
      this.groupGripApi.forEachNode((rowNode, index) => {
        if (this.app.groupsPopulated.find(g => g.dn === rowNode.data.dn)) {
          rowNode.setSelected(true);
        } else {
          rowNode.setSelected(false);
        }
      });
    },
    createImage(file) {
      const reader = new FileReader();

      reader.onload = e => {
        this.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    onFileChange(file) {
      if (!file) {
        return;
      }
      this.createImage(file);
    },
    getData: function () {
      axios.get('/api/groups')
        .then(response => {
          this.groups = response.data.groups;
          this.app.groupsPopulated = this.groups.filter(g => this.app.groups.includes(g.dn));
          return axios.get('/api/app/icons')
            .then(response => {
              this.icons = response.data.icons;
              this.app.icon = this.app.icon || this.icons[0]
              this.loaded = true;
            })
        })
        .catch(e => {});
    }
  },
  created() {

    this.getData();
  }
}
</script>