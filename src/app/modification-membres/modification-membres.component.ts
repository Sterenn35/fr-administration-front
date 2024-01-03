import {Component, OnInit} from '@angular/core';
import {FooterComponent} from "../footer/footer.component";
import {MatIconModule} from "@angular/material/icon";
import {NavComponent} from "../nav/nav.component";
import {KeyValuePipe, NgForOf, UpperCasePipe} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {User} from "../users-page/users-page.component";
import {ActivatedRoute, Router} from "@angular/router";
import {ApiHelperService} from "../services/api-helper.service";
import {lastValueFrom, Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {RoleValue} from "./role.enum";

@Component({
  selector: 'app-modification-membres',
  standalone: true,
  imports: [
    FooterComponent,
    MatIconModule,
    NavComponent,
    NgForOf,
    ReactiveFormsModule,
    UpperCasePipe,
    FormsModule,
    KeyValuePipe
  ],
  templateUrl: './modification-membres.component.html',
  styleUrl: './modification-membres.component.css'
})
export class ModificationMembresComponent implements OnInit {

  constructor(private router: Router, private api: ApiHelperService, private http: HttpClient, private route: ActivatedRoute) {}

  private assocId!:number;
  public members !: User[]; // membres initaux
  public membersModified : User[] = []// membres au cours de la modification
  public users !: User[];
  public selectedUser !:User;
  public selectedRole !: RoleValue;
  public membersToDeleteId : number[] = []; // id des membres qui ont été supprimés
  public newMembers : User[] = []; // utilisateurs qui viennent de devenir membre
  ngOnInit(): void {
    this.route.paramMap
      .subscribe(res => {
        const id = res.get("id");
        if (id != null) {
          this.assocId = +id;
          this.api.get({endpoint: '/associations/' + id + '/members'}).then(response => {
            this.members = response; // tableau initial qui ne changera pas durant la modification
            // Promise.all pour attendre la fin de toutes les requêtes asynchrones
            Promise.all(this.members.map(member => this.api.get({endpoint: '/roles/' + member.id + '/' + id})))
              .then(responses => {
                // responses est un tableau contenant les réponses pour chaque membre
                for (let i = 0; i < this.members.length; i++) {
                  // attribution du rôle à chaque membre
                  this.members[i].role = responses[i].name;
                }
                // copie du tableau de membres avec les rôles attribués
                this.membersModified = this.members.map(member => ({...member}));
              })
              .then(response => {
                const userRequest: Observable<any> = this.http.get('http://localhost:3000/users', {observe: 'response'});
                lastValueFrom(userRequest).then(response => this.users = response.body);
              })
          })
        }
      })
  }
  validate(): void {
    console.log('ON VALIDE');
    // On met à jour les membres
    this.api.put({ endpoint: '/associations/'+ this.assocId,
      data: { idUsers: this.membersToId()}}).then(response => {
      this.router.navigateByUrl('/associations/'+ this.assocId);
    })
    // On met à jour les rôles
    this.modifyRoles();
  };

  modifyRoles() {
    // mise à jour des rôles pour tous les anciens membres
    for (const member of this.membersModified) {
      this.api.put({ endpoint: '/roles/'+ member.id + '/' + this.assocId,
        data: { name: member.role}}).then(response => {
        console.log(`role modifié pour l'utilisateur ${member.id} dans l'association ${this.assocId}`);
      })
    }
    // création des rôles pour tous les nouveaux membres
    for (const newMember of this.newMembers) {
      this.api.post({ endpoint: '/roles',
        data: { name: newMember.role, idUser : newMember.id, idAssociation : this.assocId}}).then(response => {
        console.log(`role créé pour l'utilisateur ${newMember.id} dans l'association ${this.assocId}`);
      })
    }
    for (let i = 0; i < this.membersToDeleteId.length; i++) { // suppression des rôles pour tous les nouveaux membres
      this.api.delete({ endpoint: '/roles/'+ this.membersToDeleteId[i] + '/' + this.assocId}).then(response => {
        console.log(`role supprimé pour l'utilisateur ${this.membersToDeleteId[i]} dans l'association ${this.assocId}`);
      })
    }
  }

  deleteMember(user:User): void{
    console.log("début méthode delete");
    console.log(`Membres au début de deleteMember : ${JSON.stringify(this.members)}`);
    const i = this.members.indexOf(user); // position du user dans la liste initiale
    console.log(i);
    console.log(this.membersToDeleteId);
    if (i !== -1) { // on l'ajoute aux membres à supprimer que s'il appartenait à la liste initiale
      this.membersToDeleteId.push(this.members[i].id);
      console.log(`Membres après l'ajout dans ceux à supprimer : ${JSON.stringify(this.members)}`);
    }
    // on le supprime de la liste modifiée ou de la liste des nouveaux users
    const i2 = this.newMembers.findIndex(member => user.id === member.id); // position du user dans la liste modifiée
    if (i2 !== -1) { // si c'est un nouveau membre
      this.newMembers.splice(i2, 1);
      console.log(`Membres après la suppression dans les nouveaux membres : ${JSON.stringify(this.members)}`);
    } else {
      const i3 = this.membersModified.findIndex(member => user.id === member.id); // position du user dans la liste modifiée
      this.membersModified.splice(i3, 1);
      console.log(`Membres après la suppression dans les membres modifiés: ${JSON.stringify(this.members)}`);
    }
    console.log("Deleting member:", user);
    console.log(`Membres à la fin de deleteMember : ${JSON.stringify(this.members)}`);
  }

  addMember(): void{
    const idInModifiedList= this.membersModified.concat(this.newMembers).findIndex(member => this.selectedUser.id === member.id);
    if(idInModifiedList === -1){ // on n'ajoute le userSelected que s'il n'est pas déjà membre (liste modifiée)
      this.selectedUser.role = RoleValue.M; // Valeur par défaut
      if (this.membersToDeleteId.indexOf(this.selectedUser.id) !== -1) {// l'utilisateur a été supprimé sans valider
        console.log("Il a déjà été supprimé");
        // On l'enlève des utilisateurs à supprimer
        const indexToDelete = this.membersToDeleteId.indexOf(this.selectedUser.id);
        this.membersToDeleteId.splice(indexToDelete, 1);
        console.log("enlevé de la liste à supprimer", this.membersToDeleteId)
      }
      // on regarde si c'est un nouveau membre ou un présent dans la liste initiale
      const idInInitialList= this.members.findIndex(member => this.selectedUser.id === member.id);
      console.log(`indice dans liste initiale ${idInInitialList}`);
      console.log(`indice dans liste modifiée ${idInModifiedList}`);
      if(idInInitialList !== -1) { // si c'est un ancien membre on modifie son role
        console.log("Ce n'est pas un nouveau membre");
        console.log(`L'ancienne liste était ${JSON.stringify(this.membersModified)}`);
        this.membersModified.push(this.selectedUser);
        console.log(`La nouvelle liste est ${JSON.stringify(this.membersModified)}`);
      } else { // si c'est un nouveau membre on l'ajoute à la liste des nouveaux membres
        this.newMembers.push(this.selectedUser);
      }

      console.log('Adding member:', this.selectedUser);

    }
  }
  private membersToId(): number[]{
    this.members = this.members.concat(this.newMembers);
    console.log("voilà la liste des membres à update");
    console.log(JSON.stringify(this.members));
    return this.members.map(member => member.id);
  }
  protected readonly RoleValue = RoleValue;
  protected readonly Object = Object;
}