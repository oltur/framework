using System;
using System.Collections.Generic;
using System.Linq;
using Signum.Entities;
using System.Linq.Expressions;
using Signum.Utilities;
using Microsoft.SqlServer.Types;
using Microsoft.SqlServer.Server;
using Signum.Engine;
using Signum.Engine.Maps;

namespace Signum.Test.Environment
{
    [Serializable, EntityKind(EntityKind.Shared, EntityData.Transactional), Mixin(typeof(CorruptMixin)),
        Mixin(typeof(ColaboratorsMixin)), PrimaryKey(typeof(Guid))]
    public class NoteWithDateEntity : Entity
    {
        [ForceNullable]
        [StringLengthValidator(Min = 3, MultiLine = true)]
        public string Text { get; set; }

        [ForceNullable]
        [ImplementedByAll]
        public IEntity Target { get; set; }

        [ImplementedByAll]
        public Lite<IEntity>? OtherTarget { get; set; }

        public DateTime CreationTime { get; set; }

        public override string ToString()
        {
            return "{0} -> {1}".FormatWith(CreationTime, Text);
        }
    }

    [Serializable] // Just a pattern
    public class ColaboratorsMixin : MixinEntity
    {
        ColaboratorsMixin(ModifiableEntity mainEntity, MixinEntity next) : base(mainEntity, next) { }

        [NoRepeatValidator]
        public MList<ArtistEntity> Colaborators { get; set; } = new MList<ArtistEntity>();
    }

    [AutoInit]
    public static class NoteWithDateOperation
    {
        public static ExecuteSymbol<NoteWithDateEntity> Save;
    }

    [DescriptionOptions(DescriptionOptions.All)]
    public interface IAuthorEntity : IEntity
    {
        string Name { get; }

        AwardEntity? LastAward { get; }

        string FullName { get; }

        bool Lonely();
    }

    [Serializable, EntityKind(EntityKind.Shared, EntityData.Transactional)]
    public class ArtistEntity : Entity, IAuthorEntity
    {
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        public bool Dead { get; set; }

        public Sex Sex { get; set; }

        public Status? Status { get; set; }

        [AutoExpressionField]
        public bool IsMale => As.Expression(() => Sex == Sex.Male);

        [ImplementedByAll]
        public AwardEntity? LastAward { get; set; }

        [AutoExpressionField]
        public IEnumerable<Lite<Entity>> FriendsCovariant() => As.Expression(() => (IEnumerable<Lite<Entity>>)Friends);

        public MList<Lite<ArtistEntity>> Friends { get; set; } = new MList<Lite<ArtistEntity>>();

        [Ignore]
        [NoRepeatValidator]
        public MList<AwardNominationEntity> Nominations { get; set; } = new MList<AwardNominationEntity>();


        [AutoExpressionField]
        public string FullName => As.Expression(() => Name + (Dead ? " Dead" : "") + (IsMale ? " Male" : " Female"));

        [AutoExpressionField]
        public bool Lonely() => As.Expression(() => !Friends.Any());

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }

    [AutoInit]
    public static class ArtistOperation
    {
        public static ExecuteSymbol<ArtistEntity> Save;
        public static ExecuteSymbol<ArtistEntity> AssignPersonalAward;
    }

    [Flags]
    public enum Sex : short
    {
        Male,
        Female,
        Undefined
    }

    public static class SexExtensions
    {
        [AutoExpressionField]
        public static bool IsDefined(this Sex s) => As.Expression(() => s == Sex.Male || s == Sex.Female);
    }

    public enum Status
    {
        Single,
        Married,
    }

    [Serializable, EntityKind(EntityKind.Main, EntityData.Transactional)]
    public class BandEntity : Entity, IAuthorEntity
    {
        [UniqueIndex]
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        public MList<ArtistEntity> Members { get; set; } = new MList<ArtistEntity>();

        [ImplementedBy(typeof(GrammyAwardEntity), typeof(AmericanMusicAwardEntity))]
        public AwardEntity? LastAward { get; set; }

        [ImplementedBy(typeof(GrammyAwardEntity), typeof(AmericanMusicAwardEntity))]
        public MList<AwardEntity> OtherAwards { get; set; } = new MList<AwardEntity>();

        [AutoExpressionField]
        public string FullName => As.Expression(() => Name + " (" + Members.Count + " members)");

        [AutoExpressionField]
        public bool Lonely() => As.Expression(() => !Members.Any());

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }

    [AutoInit]
    public static class BandOperation
    {
        public static ExecuteSymbol<BandEntity> Save;
    }

    [Serializable, EntityKind(EntityKind.Shared, EntityData.Transactional), PrimaryKey(typeof(long))]
    public abstract class AwardEntity : Entity
    {
        public int Year { get; set; }

        [StringLengthValidator(Min = 3, Max = 100)]
        public string Category { get; set; }

        public AwardResult Result { get; set; }
    }

    [AutoInit]
    public static class AwardOperation
    {
        public static ExecuteSymbol<AwardEntity> Save;
    }

    public enum AwardResult
    {
        Won,
        Nominated
    }

    [Serializable]
    public class GrammyAwardEntity : AwardEntity
    {
    }

    [Serializable]
    public class AmericanMusicAwardEntity : AwardEntity
    {
    }

    [Serializable]
    public class PersonalAwardEntity : AwardEntity
    {
    }


    [Serializable, EntityKind(EntityKind.Main, EntityData.Master)]
    public class LabelEntity : Entity
    {
        [UniqueIndex]
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        public CountryEntity Country { get; set; }

        public Lite<LabelEntity>? Owner { get; set; }

        [UniqueIndex]
        public SqlHierarchyId Node { get; set; }

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }

    [AutoInit]
    public static class LabelOperation
    {
        public static ExecuteSymbol<LabelEntity> Save;
    }

    [Serializable, EntityKind(EntityKind.SystemString, EntityData.Master)]
    public class CountryEntity : Entity
    {
        [UniqueIndex]
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        public override string ToString()
        {
            return Name;
        }
    }

    [Serializable, EntityKind(EntityKind.Main, EntityData.Transactional)]
    public class AlbumEntity : Entity, ISecretContainer
    {
        [UniqueIndex]
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        [NumberBetweenValidator(1900, 2100)]
        public int Year { get; set; }

        [ImplementedBy(typeof(ArtistEntity), typeof(BandEntity))]
        public IAuthorEntity Author { get; set; }

        [PreserveOrder]
        public MList<SongEmbedded> Songs { get; set; } = new MList<SongEmbedded>();

        public SongEmbedded? BonusTrack { get; set; }

        [ForceNullable]
        public LabelEntity Label { get; set; }

        public AlbumState State { get; set; }

        string? ISecretContainer.Secret { get; set; }

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }

    public interface ISecretContainer
    {
        string? Secret { get; set; }
    }

    public enum AlbumState
    {
        [Ignore]
        New,
        Saved
    }

    [AutoInit]
    public static class AlbumOperation
    {
        public static ExecuteSymbol<AlbumEntity> Save;
        public static ExecuteSymbol<AlbumEntity> Modify;
        public static ConstructSymbol<AlbumEntity>.From<BandEntity> CreateAlbumFromBand;
        public static DeleteSymbol<AlbumEntity> Delete;
        public static ConstructSymbol<AlbumEntity>.From<AlbumEntity> Clone;
        public static ConstructSymbol<AlbumEntity>.FromMany<AlbumEntity> CreateGreatestHitsAlbum;
        public static ConstructSymbol<AlbumEntity>.FromMany<AlbumEntity> CreateEmptyGreatestHitsAlbum;
    }

    [Serializable]
    public class SongEmbedded : EmbeddedEntity
    {
        [StringLengthValidator(Min = 3, Max = 100)]
        public string Name { get; set; }

        TimeSpan? duration;
        public TimeSpan? Duration
        {
            get { return duration; }
            set
            {
                if (Set(ref duration, value))
                    Seconds = duration == null ? null : (int?)duration.Value.TotalSeconds;
            }
        }

        public int? Seconds { get; set; }

        public int Index { get; set; }

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }

    [Serializable, EntityKind(EntityKind.System, EntityData.Transactional)]
    public class AwardNominationEntity : Entity, ICanBeOrdered
    {
        [NotNullValidator(Disabled = true)]
        [ImplementedBy(typeof(ArtistEntity), typeof(BandEntity))]
        public Lite<IAuthorEntity> Author { get; set; }

        [ForceNullable]
        [ImplementedBy(typeof(GrammyAwardEntity), typeof(PersonalAwardEntity), typeof(AmericanMusicAwardEntity)), NotNullValidator(Disabled = true)]
        public Lite<AwardEntity> Award { get; set; }

        public int Year { get; set; }

        public int Order { get; set; }

        [PreserveOrder]
        [NoRepeatValidator]
        public MList<NominationPointEmbedded> Points { get; set; } = new MList<NominationPointEmbedded>();
    }

    [Serializable]
    public class NominationPointEmbedded : EmbeddedEntity
    {
        public int Point { get; set; }
    }

    [Serializable, EntityKind(EntityKind.Main, EntityData.Transactional)]
    public class ConfigEntity : Entity
    {
        public EmbeddedConfigEmbedded? EmbeddedConfig { get; set; }
    }

    [AutoInit]
    public static class ConfigOperation
    {
        public static ExecuteSymbol<ConfigEntity> Save;
    }

    public class EmbeddedConfigEmbedded : EmbeddedEntity
    {
        public Lite<LabelEntity>? DefaultLabel { get; set; }

        [NoRepeatValidator]
        public MList<Lite<GrammyAwardEntity>> Awards { get; set; } = new MList<Lite<GrammyAwardEntity>>();
    }



    public static class MinimumExtensions
    {
        [SqlMethod(Name = "dbo.MinimumTableValued")]
        public static IQueryable<IntValue> MinimumTableValued(int? a, int? b)
        {
            throw new InvalidOperationException("sql only");
        }


        [SqlMethod(Name = "dbo.MinimumScalar")]
        public static int? MinimumScalar(int? a, int? b)
        {
            throw new InvalidOperationException("sql only");
        }

        internal static void IncludeFunction(SchemaAssets assets)
        {
            assets.IncludeUserDefinedFunction("MinimumTableValued", @"(@Param1 Integer, @Param2 Integer)
RETURNS Table As
RETURN (SELECT Case When @Param1 < @Param2 Then @Param1
               Else COALESCE(@Param2, @Param1) End MinValue)");


            assets.IncludeUserDefinedFunction("MinimumScalar", @"(@Param1 Integer, @Param2 Integer)
RETURNS Integer
AS
BEGIN
   RETURN (Case When @Param1 < @Param2 Then @Param1
           Else COALESCE(@Param2, @Param1) End);
END");
        }
    }

    public class IntValue : IView
    {
        public int? MinValue;
    }



    [Serializable, EntityKind(EntityKind.System, EntityData.Transactional)]
    public class FolderEntity : Entity
    {
        [UniqueIndex]
        [StringLengthValidator(Max = 100)]
        public string Name { get; set; }

        public Lite<FolderEntity>? Parent { get; set; }

        [AutoExpressionField]
        public override string ToString() => As.Expression(() => Name);
    }
}
